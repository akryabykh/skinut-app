import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus, Settings, UsersRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrency } from "@/lib/currencies";

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
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "участника";
  return "участников";
}

export default async function ProjectsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in");
  }

  // RLS now filters by project_members membership (Block 3b migration).
  // No explicit owner_id filter — viewers/editors see their projects too.
  const { data: projects } = await supabase
    .from("app_projects")
    .select("id, name, updated_at, primary_currency, secondary_currency")
    .order("updated_at", { ascending: false });

  const items = projects ?? [];

  // Second query to attach member counts. RLS lets us see only the rows
  // for projects we're a member of, so we get the project_id list and
  // count locally.
  const memberCounts = new Map<string, number>();
  if (items.length > 0) {
    const { data: memberships } = await supabase
      .from("project_members")
      .select("project_id")
      .in(
        "project_id",
        items.map((p) => p.id),
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
        <Link
          href="/account"
          className="inline-flex items-center h-10 px-3 text-[0.92rem] font-semibold text-ink hover:text-accent transition-colors"
        >
          Личный кабинет
        </Link>
      </header>

      <section className="grid gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted mb-2">
              Мои проекты
            </p>
            <h1 className="text-[2rem] sm:text-[2.4rem] font-bold tracking-[-0.025em] text-ink leading-tight">
              Расчёты, которые вы&nbsp;ведёте
            </h1>
          </div>
          <LinkButton href="/app/projects/new" variant="primary" size="cta">
            <Plus size={18} aria-hidden="true" />
            <span>Новый проект</span>
          </LinkButton>
        </div>

        {items.length === 0 ? (
          <Card variant="muted" className="!p-10 text-center">
            <p className="text-[1.1rem] font-semibold text-ink mb-1">
              У вас пока нет проектов
            </p>
            <p className="text-[0.95rem] text-muted mb-5 leading-snug">
              Создайте первый расчёт — для поездки, ужина или совместной покупки.
            </p>
            <LinkButton href="/app/projects/new" variant="primary" size="md">
              <Plus size={16} aria-hidden="true" />
              <span>Создать проект</span>
            </LinkButton>
          </Card>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3 list-none p-0 m-0">
            {items.map((project) => {
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
