import { ExpenseCalculator } from "@/components/expense-calculator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_PRIMARY_CURRENCY } from "@/lib/currencies";
import { getExchangeRate } from "@/lib/exchange-rate";
import { listProjectMembers } from "./projects/members-actions";
import type { Person } from "@/lib/split-calculator";

type SearchParams = Record<string, string | string[] | undefined>;

type AppPageProps = {
  searchParams?: Promise<SearchParams>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AppPage({ searchParams }: AppPageProps) {
  const params: SearchParams = searchParams ? await searchParams : {};
  const projectId = firstParam(params.project);

  // Guest mode: no project param → calculator uses localStorage,
  // defaults to RUB primary, no secondary.
  if (!projectId) {
    return <ExpenseCalculator />;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Tried to open a project link without auth — fall back to guest mode.
  if (!user) {
    return <ExpenseCalculator />;
  }

  // RLS filters by membership now; if the user isn't a member we get null.
  const { data: project } = await supabase
    .from("app_projects")
    .select(
      "id, name, payload, primary_currency, secondary_currency, manual_rate, share_token",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return <ExpenseCalculator />;
  }

  // Determine current user's role so we can switch the calculator into
  // read-only mode for viewers. RLS already restricts the row above, so
  // this query is just for the role, not for access control.
  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", project.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const canEdit =
    membership?.role === "owner" || membership?.role === "editor";

  // Profile data for the AppHeader user-menu (avatar + dropdown).
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const myEmail = user.email ?? profile?.email ?? "—";
  const myFallbackName =
    user.email && user.email.includes("@")
      ? user.email.split("@")[0]
      : "Пользователь";
  const myDisplayName = profile?.display_name ?? myFallbackName;
  const myAvatarUrl = profile?.avatar_url ?? null;

  // === Block 12 (1): sync project_members → payload.people ===
  //
  // Whenever a logged-in user opens the calculator, we make sure that
  // everyone in project_members (creator, invited editors/viewers) has
  // a matching entry in payload.people — so members don't need to add
  // themselves manually to the split-list.
  //
  // We identify member-people by id === auth.users.id (uuid format same
  // as crypto.randomUUID() — won't collide). Manual people added via the
  // form keep their own client-generated ids and are untouched.
  let workingPayload = (project.payload ?? {}) as {
    people?: Person[];
    expenses?: unknown;
    projectName?: string;
    expenseSort?: string;
  };

  if (canEdit) {
    const members = await listProjectMembers(project.id);
    const existingIds = new Set(
      (workingPayload.people ?? []).map((p) => p.id),
    );
    const missing = members.filter((m) => !existingIds.has(m.user_id));

    if (missing.length > 0) {
      const newPeople: Person[] = missing.map((m) => ({
        id: m.user_id,
        name:
          m.display_name?.trim() ||
          (m.email ? m.email.split("@")[0] : null) ||
          "Участник",
      }));
      workingPayload = {
        ...workingPayload,
        people: [...(workingPayload.people ?? []), ...newPeople],
      };
      // Best-effort save back — if it fails (e.g. RLS), the in-memory
      // payload is still sent to the client and saved on the next edit.
      await supabase
        .from("app_projects")
        .update({ payload: workingPayload as never })
        .eq("id", project.id);
    }
  }

  // Правило: курс зафиксирован на проекте при создании (поле manual_rate,
  // см. миграцию 20260523000002_manual_rate.sql). Калькулятор просто
  // читает зафиксированное значение — никакого live-fetch здесь нет,
  // чтобы расхождение между «вижу в шапке» и «застамплено на трате»
  // было невозможно.
  //
  // Для legacy-проектов (созданных до фиксации правила) делаем разовый
  // backfill: если есть secondary, но manual_rate is null — фетчим и
  // обновляем проект, чтобы дальше работала единая логика. Best-effort:
  // если апстрим недоступен, currentRate остаётся null, хинт скрыт,
  // owner увидит на следующем открытии или подставит курс вручную.
  let currentRate: number | null = null;
  const primaryCode = project.primary_currency ?? DEFAULT_PRIMARY_CURRENCY;
  if (project.secondary_currency && project.secondary_currency !== primaryCode) {
    if (
      typeof project.manual_rate === "number" &&
      project.manual_rate > 0
    ) {
      currentRate = project.manual_rate;
    } else if (canEdit) {
      try {
        const result = await getExchangeRate(
          project.secondary_currency,
          primaryCode,
        );
        currentRate = result.rate;
        // Lazy backfill — фиксируем курс на проекте, чтобы это был
        // последний раз, когда мы дёрнули live API для этого проекта.
        await supabase
          .from("app_projects")
          .update({ manual_rate: currentRate })
          .eq("id", project.id);
      } catch (err) {
        console.warn(
          `[app/page] backfill manual_rate ${project.secondary_currency}→${primaryCode} failed`,
          err,
        );
      }
    }
  }

  return (
    <ExpenseCalculator
      projectId={project.id}
      initialName={project.name}
      initialPayload={workingPayload as never}
      canEdit={canEdit}
      primaryCurrency={primaryCode}
      secondaryCurrency={project.secondary_currency}
      shareToken={project.share_token}
      currentRate={currentRate}
      userDisplayName={myDisplayName}
      userAvatarUrl={myAvatarUrl}
      userEmail={myEmail}
    />
  );
}
