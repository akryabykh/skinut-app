import { redirect } from "next/navigation";
import { ArrowRight, Plus, Settings, UsersRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrency } from "@/lib/currencies";
import { signOut } from "../auth/actions";
import { AccountForm } from "./account-form";

function formatDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function pluralPeople(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "участник";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return "участника";
  return "участников";
}

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const email = user.email ?? "—";
  const fallbackName =
    user.email && user.email.includes("@")
      ? user.email.split("@")[0]
      : "Пользователь";
  const displayName = profile?.display_name ?? fallbackName;

  // Block 11: projects list moved here from /app/projects.
  const { data: projects } = await supabase
    .from("app_projects")
    .select("id, name, updated_at, primary_currency, secondary_currency")
    .order("updated_at", { ascending: false });

  const projectItems = projects ?? [];

  const memberCounts = new Map<string, number>();
  if (projectItems.length > 0) {
    const { data: memberships } = await supabase
      .from("project_members")
      .select("project_id")
      .in(
        "project_id",
        projectItems.map((p) => p.id),
      );
    (memberships ?? []).forEach((row) => {
      memberCounts.set(
        row.project_id,
        (memberCounts.get(row.project_id) ?? 0) + 1,
      );
    });
  }

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-16">
      <header className="flex items-center justify-between gap-3 mb-8">
        <Brand href="/" />
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Выйти
          </Button>
        </form>
      </header>

      {/* === Profile === */}
      <section className="grid gap-6 mb-10">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted mb-2">
            Личный кабинет
          </p>
          <h1 className="text-[2rem] sm:text-[2.4rem] font-bold tracking-[-0.025em] text-ink leading-tight">
            Здравствуйте, {displayName}
          </h1>
        </div>

        <div className="grid sm:grid-cols-[1.2fr_0.8fr] gap-3">
          <Card className="!p-6">
            <h2 className="text-[1rem] font-bold tracking-[-0.01em] text-ink mb-1">
              Профиль
            </h2>
            <p className="text-[0.88rem] text-muted leading-snug mb-4">
              Имя видят участники ваших проектов.
            </p>
            <AccountForm initialDisplayName={displayName} email={email} />
          </Card>
          <Card variant="muted" className="!p-5 self-start">
            <p className="text-[0.78rem] font-medium text-muted mb-1">Email</p>
            <p className="text-[0.95rem] font-semibold text-ink break-all">
              {email}
            </p>
          </Card>
        </div>
      </section>

      {/* === Projects === */}
      <section className="grid gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted mb-2">
              Мои проекты
            </p>
            <h2 className="text-[1.6rem] sm:text-[1.85rem] font-bold tracking-[-0.02em] text-ink leading-tight">
              Расчёты, которые вы ведёте
            </h2>
          </div>
          <LinkButton href="/app/projects/new" variant="primary" size="cta">
            <Plus size={18} aria-hidden="true" />
            <span>Новый проект</span>
          </LinkButton>
        </div>

        {projectItems.length === 0 ? (
          <Card variant="muted" className="!p-10 text-center">
            <p className="text-[1.1rem] font-semibold text-ink mb-1">
              Проектов пока нет
            </p>
            <p className="text-[0.95rem] text-muted mb-5 leading-snug">
              Создайте первый расчёт — для поездки, ужина или совместной
              покупки.
            </p>
            <LinkButton href="/app/projects/new" variant="primary" size="md">
              <Plus size={16} aria-hidden="true" />
              <span>Создать проект</span>
            </LinkButton>
          </Card>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3 list-none p-0 m-0">
            {projectItems.map((project) => {
              const primary = project.primary_currency ?? "RUB";
              const secondary = project.secondary_currency;
              const primaryInfo = getCurrency(primary);
              const secondaryInfo = secondary ? getCurrency(secondary) : null;
              const memberCount = memberCounts.get(project.id) ?? 0;
              return (
                <li key={project.id} className="contents">
                  <Card className="!p-5 flex flex-col gap-4 hover:border-[#D4D4D8] transition-colors">
                    <div className="flex items-start justify-between gap-3 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-[1.05rem] font-bold tracking-[-0.01em] text-ink truncate">
                          {project.name}
                        </p>
                        <p className="text-[0.82rem] text-muted mt-1">
                          Обновлён {formatDate(project.updated_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <span className="inline-flex items-center h-6 px-2 rounded-full bg-accent-soft text-accent-dark text-[0.72rem] font-semibold tracking-[0.02em]">
                          {primary}
                          {primaryInfo ? ` ${primaryInfo.symbol}` : ""}
                        </span>
                        {secondary && secondaryInfo ? (
                          <span className="inline-flex items-center h-6 px-2 rounded-full bg-[#F4F4F1] text-ink text-[0.72rem] font-semibold tracking-[0.02em]">
                            {secondary} {secondaryInfo.symbol}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[0.85rem] text-muted">
                      <UsersRound size={14} aria-hidden="true" />
                      <span>
                        {memberCount} {pluralPeople(memberCount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <LinkButton
                        href={`/app?project=${project.id}`}
                        variant="primary"
                        size="sm"
                        className="flex-1"
                      >
                        <span>Открыть</span>
                        <ArrowRight size={14} aria-hidden="true" />
                      </LinkButton>
                      <LinkButton
                        href={`/app/projects/${project.id}`}
                        variant="secondary"
                        size="sm"
                        aria-label={`Настройки проекта «${project.name}»`}
                      >
                        <Settings size={14} aria-hidden="true" />
                      </LinkButton>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
