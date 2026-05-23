"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_PRIMARY_CURRENCY,
  isCurrencyCode,
  type CurrencyCode,
} from "@/lib/currencies";
import { getExchangeRate } from "@/lib/exchange-rate";

// Helper: ensures we have a Supabase client and a logged-in user.
// If the user isn't logged in, redirects to sign-in (NEXT_REDIRECT thrown).
async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in");
  }
  return { supabase, user };
}

// Zod schema for the create-project form.
// `secondary` may arrive as the empty string (when the user leaves the
// optional select on its placeholder) — we coerce that to null.
const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Название обязательно")
    .max(120, "Слишком длинное"),
  primary: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isCurrencyCode, "Неподдерживаемая основная валюта"),
  secondary: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(
      (v) => v === null || isCurrencyCode(v),
      "Неподдерживаемая дополнительная валюта",
    ),
});

// Creates a project with name + currencies and redirects to the calculator
// pointing at it. Form-based — called from /app/projects/new which renders
// a small form with name + primary/secondary selects.
//
// Internally goes through the SECURITY DEFINER RPC `create_app_project`
// to bypass the RLS SELECT race condition (see Block 3b fix migration).
export async function createProject(formData: FormData) {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    primary: formData.get("primary"),
    secondary: formData.get("secondary"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
  }

  const { name, primary, secondary } = parsed.data;

  if (secondary && secondary === primary) {
    throw new Error("Дополнительная валюта должна отличаться от основной");
  }

  const { supabase } = await requireUser();

  const { data: projectId, error } = await supabase.rpc("create_app_project", {
    p_name: name,
    p_primary_currency: primary,
    p_secondary_currency: secondary,
  });

  if (error || !projectId) {
    throw new Error(error?.message ?? "Не удалось создать проект");
  }

  revalidatePath("/app/projects");
  redirect(`/app?project=${projectId}`);
}

const renameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Название обязательно").max(120, "Слишком длинное"),
});

export async function renameProject(formData: FormData) {
  const parsed = renameSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
  }

  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("app_projects")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app/projects");
}

const deleteSchema = z.object({
  id: z.string().uuid(),
});

// Schema for editing the primary/secondary currency of an existing project.
// Same currency-validation rules as createProjectSchema; we just guard
// projectId as uuid here.
const editCurrenciesSchema = z.object({
  projectId: z.string().uuid(),
  primary: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isCurrencyCode, "Неподдерживаемая основная валюта"),
  secondary: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine(
      (v) => v === null || isCurrencyCode(v),
      "Неподдерживаемая дополнительная валюта",
    ),
});

// Block 5: Edit project's primary and/or secondary currency after creation.
//
// Guard rails:
//   - Cannot change primary if the project has any saved expenses — the
//     existing exchange_rate_used multipliers were computed against the
//     old primary; changing it would silently distort historical totals.
//     The user must either delete those expenses or stay on the same primary.
//   - Cannot remove secondary (or replace it with another code) if there
//     are expenses denominated in that secondary — same logic: those rows
//     would orphan their currency context.
//   - primary != secondary (or secondary is null) — enforced by DB CHECK
//     and by client-side schema.
//
// RLS does the authorization (only editor/owner can update app_projects).
export async function updateProjectCurrencies(formData: FormData) {
  const parsed = editCurrenciesSchema.safeParse({
    projectId: formData.get("projectId"),
    primary: formData.get("primary"),
    secondary: formData.get("secondary"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
  }

  const { projectId, primary, secondary } = parsed.data;

  if (secondary && secondary === primary) {
    throw new Error("Дополнительная валюта должна отличаться от основной");
  }

  const { supabase } = await requireUser();

  const { data: project, error: loadError } = await supabase
    .from("app_projects")
    .select("primary_currency, secondary_currency, payload")
    .eq("id", projectId)
    .maybeSingle();
  if (loadError || !project) {
    throw new Error(loadError?.message ?? "Проект не найден");
  }

  const oldPrimary = project.primary_currency ?? DEFAULT_PRIMARY_CURRENCY;
  const oldSecondary = project.secondary_currency as string | null;

  // Inspect existing expenses to enforce the guard rails.
  const payload = (project.payload ?? {}) as { expenses?: unknown };
  const expenses = Array.isArray(payload.expenses)
    ? (payload.expenses as Array<{ currency?: unknown }>)
    : [];

  const expenseCurrencies = new Set<string>();
  for (const e of expenses) {
    if (e && typeof e.currency === "string" && e.currency.length === 3) {
      expenseCurrencies.add(e.currency.toUpperCase());
    } else {
      // Legacy expense with no explicit currency = treated as primary.
      expenseCurrencies.add(oldPrimary);
    }
  }

  // Rule 1: changing primary while expenses exist would corrupt history.
  if (primary !== oldPrimary && expenseCurrencies.size > 0) {
    throw new Error(
      "Основную валюту нельзя сменить — в проекте уже есть траты с зафиксированными курсами. Удалите траты или создайте новый проект.",
    );
  }

  // Rule 2: removing/changing secondary while there are expenses in the
  // *old* secondary would orphan them.
  if (
    oldSecondary &&
    secondary !== oldSecondary &&
    expenseCurrencies.has(oldSecondary)
  ) {
    throw new Error(
      `Нельзя удалить или сменить дополнительную валюту (${oldSecondary}) — в проекте есть траты в ней.`,
    );
  }

  const { error: updateError } = await supabase
    .from("app_projects")
    .update({
      primary_currency: primary,
      secondary_currency: secondary,
    })
    .eq("id", projectId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/projects");
  revalidatePath("/app");
}

export async function deleteProject(formData: FormData) {
  const parsed = deleteSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) {
    throw new Error("Некорректный id");
  }

  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("app_projects")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app/projects");
}

// Save the calculator's JSON state into the project row.
//
// Block 4 additions:
//   - Server validates that each expense.currency (when present) is one
//     of {project.primary, project.secondary}. Unknown codes → error.
//   - For expenses paid in the secondary currency, the server fetches
//     and records `exchange_rate_used` (multiplier → primary) at save
//     time. Already-set rates are preserved so history doesn't drift.
//
// Returns the new updated_at so the client can show "saved at".
export async function saveProjectPayload(
  id: string,
  payload: unknown,
): Promise<{ updatedAt: string }> {
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Некорректный id");
  }

  const { supabase } = await requireUser();

  // Load project's currencies so we can validate & enrich.
  const { data: project, error: loadError } = await supabase
    .from("app_projects")
    .select("primary_currency, secondary_currency")
    .eq("id", id)
    .single();
  if (loadError || !project) {
    throw new Error(loadError?.message ?? "Проект не найден");
  }

  const primary = (project.primary_currency ??
    DEFAULT_PRIMARY_CURRENCY) as CurrencyCode;
  const secondary = project.secondary_currency as CurrencyCode | null;

  const enrichedPayload = await enrichPayloadCurrencies(payload, {
    primary,
    secondary,
  });

  const update: { payload: unknown; name?: string } = { payload: enrichedPayload };
  if (
    typeof enrichedPayload === "object" &&
    enrichedPayload !== null &&
    "projectName" in enrichedPayload
  ) {
    const candidate = (enrichedPayload as { projectName: unknown }).projectName;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      update.name = candidate.trim();
    }
  }

  const { data, error } = await supabase
    .from("app_projects")
    .update(update as never)
    .eq("id", id)
    .select("updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Не удалось сохранить");
  }

  return { updatedAt: data.updated_at };
}

// Returns the current (cached or freshly fetched) exchange rate between
// two ISO codes. Used by the calculator before adding an expense in the
// secondary currency — the client stamps the rate onto the new expense
// itself so the UI shows the converted-to-primary amount immediately
// (without waiting for the next saveProjectPayload round-trip).
//
// Trust model: the server is the source of truth either way — when the
// expense reaches saveProjectPayload, if a rate is already attached the
// server preserves it (locking history); if absent, the server fetches
// and stamps. Letting the client pre-fetch is purely a latency
// optimisation, not a trust delegation.
//
// No auth required — anyone with a share-token link could also benefit
// from the same lookup, and the upstream API is public.
export async function fetchCurrentRate(
  from: string,
  to: string,
): Promise<number> {
  if (!isCurrencyCode(from) || !isCurrencyCode(to)) {
    throw new Error("Неверный код валюты");
  }
  if (from === to) return 1;
  const result = await getExchangeRate(from, to);
  return result.rate;
}

// ============================================================
// Internal: currency enrichment
// ============================================================

type EnrichContext = {
  primary: CurrencyCode;
  secondary: CurrencyCode | null;
};

type IncomingExpense = {
  id?: unknown;
  name?: unknown;
  amount?: unknown;
  payerId?: unknown;
  participantIds?: unknown;
  createdAt?: unknown;
  currency?: unknown;
  exchange_rate_used?: unknown;
};

async function enrichPayloadCurrencies(
  payload: unknown,
  ctx: EnrichContext,
): Promise<unknown> {
  if (typeof payload !== "object" || payload === null) {
    return payload;
  }

  const obj = payload as { expenses?: unknown };
  if (!Array.isArray(obj.expenses)) {
    return payload;
  }

  const allowed = new Set<CurrencyCode>([
    ctx.primary,
    ...(ctx.secondary ? [ctx.secondary] : []),
  ]);

  // Cache rate lookups inside a single save — most trips have one secondary
  // currency, so we'll fetch the rate at most once per request.
  const rateCache = new Map<string, number>();

  const enrichedExpenses = await Promise.all(
    (obj.expenses as IncomingExpense[]).map(async (expense) => {
      // Pass through if it's not even shaped like an expense — the
      // upstream normalizer in the calculator will filter it anyway.
      if (typeof expense !== "object" || expense === null) return expense;

      const rawCurrency =
        typeof expense.currency === "string" && expense.currency.trim()
          ? expense.currency.trim().toUpperCase()
          : ctx.primary; // legacy expense → assume primary

      if (!isCurrencyCode(rawCurrency)) {
        throw new Error(`Неизвестный код валюты: ${rawCurrency}`);
      }
      if (!allowed.has(rawCurrency)) {
        throw new Error(
          `Валюта ${rawCurrency} не настроена для этого проекта`,
        );
      }

      // Same as primary → multiplier is exactly 1.
      if (rawCurrency === ctx.primary) {
        return {
          ...expense,
          currency: rawCurrency,
          exchange_rate_used: 1,
        };
      }

      // Already has a captured rate from a previous save → preserve it.
      // This is the rule that keeps historical totals stable when the
      // fx rate changes later.
      const existingRate = Number(expense.exchange_rate_used);
      if (Number.isFinite(existingRate) && existingRate > 0) {
        return {
          ...expense,
          currency: rawCurrency,
          exchange_rate_used: existingRate,
        };
      }

      // Secondary currency, no rate yet — fetch and stamp.
      const cacheKey = `${rawCurrency}->${ctx.primary}`;
      let rate = rateCache.get(cacheKey);
      if (rate === undefined) {
        const result = await getExchangeRate(rawCurrency, ctx.primary);
        rate = result.rate;
        rateCache.set(cacheKey, rate);
      }
      return {
        ...expense,
        currency: rawCurrency,
        exchange_rate_used: rate,
      };
    }),
  );

  return { ...obj, expenses: enrichedExpenses };
}
