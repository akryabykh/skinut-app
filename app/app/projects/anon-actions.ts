"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SAVE_CONFLICT_MESSAGE, type SaveResult } from "@/lib/project-save-queue";

// Тонкие обёртки вокруг RPC из миграции 20260528_anon_projects.sql.
// SECURITY DEFINER на стороне БД отвечает за реальную авторизацию;
// здесь — только нормализация ошибок + редиректы для UX.

/** Создаёт анонимный проект с дефолтными параметрами (RUB, без secondary)
 *  и редиректит на `/p/<edit_token>`. URL в адресной строке сразу
 *  shareable — точно как у конкурентов skolkoskinut.ru. */
export async function createAnonProject(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  const { data: token, error } = await supabase.rpc("create_anon_project", {
    p_name: null,
    p_primary_currency: "RUB",
    p_secondary_currency: null,
  });
  if (error || !token) {
    throw new Error(error?.message ?? "Не удалось создать расчёт");
  }
  redirect(`/p/${token}`);
}

/** Saves only the version the caller loaded. Claimed projects remain
 * writable by edit-link and return a null expiry; stale snapshots return
 * a conflict without touching the current calculation. */
export async function saveAnonProjectPayload(
  token: string,
  payload: unknown,
  expectedUpdatedAt: string,
  name?: string,
): Promise<SaveResult> {
  if (!token) throw new Error("Пустой token");
  const supabase = await createSupabaseServerClient();
  // Cast through unknown: payload arrives as the calculator's ProjectState
  // which is JSON-compatible at runtime but TS's Json union is narrower.
  const { data, error } = await supabase.rpc("save_anon_project", {
    p_token: token,
    p_payload: payload as never,
    p_expected_updated_at: expectedUpdatedAt,
    p_name: name ?? null,
  });
  if (error) return { ok: false, reason: "error", message: "Не удалось сохранить расчёт. Повторите попытку." };
  const saved = data?.[0];
  if (!saved) return { ok: false, reason: "conflict", message: SAVE_CONFLICT_MESSAGE };
  return { ok: true, updatedAt: saved.updated_at, expiresAt: saved.expires_at };
}

/** Авторизованный юзер забирает анон в свою собственность. Возвращает
 *  новый project id; клиент после успеха редиректит на /app?project=<id>. */
export async function claimAnonProject(
  token: string,
): Promise<{ id: string }> {
  if (!token) throw new Error("Пустой token");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("claim_anon_project", {
    p_token: token,
  });
  if (error || !data) {
    throw new Error(error?.message ?? "Не удалось сохранить проект себе");
  }
  revalidatePath("/app/projects");
  return { id: data as string };
}
