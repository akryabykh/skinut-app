import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/app-header/app-header";
import { LinkButton } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrency } from "@/lib/currencies";
import type { Expense, Person } from "@/lib/split-calculator";
import { listProjectMembers } from "../members-actions";
import { ROLE_LABEL_RU } from "../members-state";
import { ProjectManagement } from "./project-management";

type Params = Promise<{ id: string }>;

export default async function ProjectDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: project } = await supabase
    .from("app_projects")
    .select(
      "id, name, share_token, edit_token, primary_currency, secondary_currency, manual_rate, payload",
    )
    .eq("id", id)
    .maybeSingle();

  // notFound covers both "doesn't exist" and "RLS hid it because you
  // aren't a member" — both look the same to the user and that's fine.
  if (!project) {
    notFound();
  }

  const members = await listProjectMembers(project.id);
  const myMembership = members.find((m) => m.user_id === user.id);
  if (!myMembership) {
    notFound();
  }

  // Load own profile for AppHeader user menu.
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

  const primary = project.primary_currency ?? "RUB";
  const secondary = project.secondary_currency;
  const primaryInfo = getCurrency(primary);
  const secondaryInfo = secondary ? getCurrency(secondary) : null;

  // Parse payload once — used by the currencies editor (hasExpenses)
  // and by the export buttons (people, expenses).
  const payload = (project.payload ?? {}) as {
    people?: unknown;
    expenses?: unknown;
  };
  const people: Person[] = Array.isArray(payload.people)
    ? (payload.people as Person[]).filter(
        (p) => p && typeof p.id === "string" && typeof p.name === "string",
      )
    : [];
  const expenses: Expense[] = Array.isArray(payload.expenses)
    ? (payload.expenses as Expense[]).filter(
        (e) => e && e.id && e.payerId && Number(e.amount) > 0,
      )
    : [];
  const hasExpenses = expenses.length > 0;

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-16">
      <AppHeader
        displayName={myDisplayName}
        avatarUrl={myAvatarUrl}
        email={myEmail}
        active="projects"
      />

      <Link
        href="/app/projects"
        className="inline-flex items-center gap-1.5 mb-4 text-[0.88rem] font-semibold text-muted hover:text-ink transition-colors"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        <span>К списку проектов</span>
      </Link>

      <section className="grid gap-6">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted mb-2">
            Проект
          </p>
          <h1 className="text-[2rem] sm:text-[2.4rem] font-bold tracking-[-0.025em] text-ink leading-tight">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center h-6 px-2 rounded-full bg-accent-soft text-accent-dark text-[0.72rem] font-semibold tracking-[0.02em]">
              {primary}
              {primaryInfo ? ` ${primaryInfo.symbol}` : ""}
            </span>
            {secondary && secondaryInfo ? (
              <span className="inline-flex items-center h-6 px-2 rounded-full bg-[#F4F4F1] text-ink text-[0.72rem] font-semibold tracking-[0.02em]">
                {secondary} {secondaryInfo.symbol}
              </span>
            ) : null}
            <span className="text-[0.85rem] text-muted">
              Ваша роль:{" "}
              <span className="font-semibold text-ink">
                {ROLE_LABEL_RU[myMembership.role]}
              </span>
            </span>
          </div>
          <div className="mt-5">
            <LinkButton
              href={`/app?project=${project.id}`}
              variant="primary"
              size="cta"
            >
              <span>Открыть калькулятор</span>
              <ArrowRight size={18} aria-hidden="true" />
            </LinkButton>
          </div>
        </div>

        <ProjectManagement
          projectId={project.id}
          projectName={project.name}
          shareToken={project.share_token}
          editToken={project.edit_token}
          members={members}
          currentUserId={user.id}
          myRole={myMembership.role}
          primaryCurrency={primary}
          secondaryCurrency={secondary}
          manualRate={
            typeof project.manual_rate === "number" && project.manual_rate > 0
              ? project.manual_rate
              : null
          }
          hasExpenses={hasExpenses}
          people={people}
          expenses={expenses}
        />
      </section>
    </main>
  );
}
