import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  calculateTransfers,
  getTotalAmount,
  type Expense,
  type Person,
} from "@/lib/split-calculator";
import {
  DEFAULT_PRIMARY_CURRENCY,
  formatMoney,
  getCurrency,
} from "@/lib/currencies";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type PublicPayload = {
  projectName?: unknown;
  people?: unknown;
  expenses?: unknown;
};

type Params = Promise<{ token: string }>;

export default async function PublicSharePage({
  params,
}: {
  params: Params;
}) {
  const { token } = await params;

  if (!UUID_RE.test(token)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_public_project_summary", {
    p_token: token,
  });

  if (error || !data || data.length === 0) {
    notFound();
  }

  const row = data[0];
  const payload = (row.payload ?? {}) as PublicPayload;
  const primaryCurrency =
    (row.primary_currency as string | null) ?? DEFAULT_PRIMARY_CURRENCY;
  const primaryInfo = getCurrency(primaryCurrency);
  const secondary = row.secondary_currency as string | null;
  const secondaryInfo = secondary ? getCurrency(secondary) : null;

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

  const transfers = calculateTransfers(people, expenses);
  const totalAmount = getTotalAmount(expenses);

  function nameOf(personId: string): string {
    return people.find((p) => p.id === personId)?.name ?? "Участник";
  }

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-16">
      <header className="flex items-center justify-between gap-3 mb-8">
        <Brand href="/" />
        <LinkButton href="/auth/sign-up" variant="secondary" size="sm">
          Создать свой расчёт
        </LinkButton>
      </header>

      <section className="grid gap-6">
        {/* === Project hero === */}
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted mb-2">
            Публичный итог
          </p>
          <h1 className="text-[2rem] sm:text-[2.4rem] font-bold tracking-[-0.025em] text-ink leading-tight">
            {row.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center h-6 px-2 rounded-full bg-accent-soft text-accent-dark text-[0.72rem] font-semibold tracking-[0.02em]">
              {primaryCurrency}
              {primaryInfo ? ` ${primaryInfo.symbol}` : ""}
            </span>
            {secondary && secondaryInfo ? (
              <span className="inline-flex items-center h-6 px-2 rounded-full bg-[#F4F4F1] text-ink text-[0.72rem] font-semibold tracking-[0.02em]">
                {secondary} {secondaryInfo.symbol}
              </span>
            ) : null}
            <span className="text-[0.85rem] text-muted">
              Обновлён {formatDate(row.updated_at)}
            </span>
          </div>
        </div>

        {/* === Total === */}
        <Card className="!p-6 !bg-gradient-to-b from-white to-accent-soft/40">
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-muted mb-2">
            Всего потрачено
          </p>
          <p className="text-[2.4rem] sm:text-[3rem] font-bold tracking-[-0.02em] text-ink font-mono tabular-nums leading-none">
            {formatMoney(totalAmount, primaryCurrency, { compact: true })}
          </p>
        </Card>

        {/* === Transfers === */}
        <div>
          <h2 className="text-[1.15rem] font-bold tracking-[-0.01em] text-ink mb-3">
            Итог переводов
          </h2>
          {transfers.length === 0 ? (
            <div className="grid gap-1 border border-dashed border-line rounded-card bg-paper px-4 py-6 text-center">
              <strong className="text-[0.95rem] font-semibold text-ink">
                Все в нуле
              </strong>
              <span className="text-[0.85rem] text-muted leading-snug">
                Никому ничего не должны.
              </span>
            </div>
          ) : (
            <div className="grid gap-2">
              {transfers.map((t) => (
                <article
                  key={`${t.from}-${t.to}-${t.amount}`}
                  className="border border-line rounded-card bg-white px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <strong className="text-[0.95rem] font-semibold text-ink truncate">
                        {nameOf(t.from)}
                      </strong>
                      <ArrowRight
                        size={14}
                        aria-hidden="true"
                        className="text-muted shrink-0"
                      />
                      <strong className="text-[0.95rem] font-semibold text-ink truncate">
                        {nameOf(t.to)}
                      </strong>
                    </div>
                    <span className="font-mono tabular-nums font-bold text-accent whitespace-nowrap">
                      {formatMoney(t.amount, primaryCurrency, { compact: true })}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* === CTA === */}
        <Card variant="muted" className="!p-6 text-center">
          <p className="text-[0.95rem] text-muted leading-snug mb-4">
            Это снимок расчёта на момент {formatDate(row.updated_at)}.
            Заведите аккаунт, чтобы вести свои проекты — это бесплатно.
          </p>
          <LinkButton href="/auth/sign-up" variant="primary" size="cta">
            <span>Создать аккаунт</span>
            <ArrowRight size={18} aria-hidden="true" />
          </LinkButton>
        </Card>

        <footer className="text-center pt-4 border-t border-line">
          <Link
            href="/"
            className="text-[0.88rem] text-muted hover:text-ink transition-colors"
          >
            Скинуться. — делите расходы спокойно
          </Link>
        </footer>
      </section>
    </main>
  );
}
