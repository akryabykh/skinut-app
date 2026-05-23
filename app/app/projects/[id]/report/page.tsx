import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  calculatePersonalCosts,
  calculateTransfers,
  getTotalAmount,
  toPrimary,
  type Expense,
  type Person,
} from "@/lib/split-calculator";
import {
  DEFAULT_PRIMARY_CURRENCY,
  formatMoney,
  getCurrency,
} from "@/lib/currencies";
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  getCategory,
  isCategoryId,
} from "@/lib/categories";

type Params = Promise<{ id: string }>;

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Printable expense report. Designed to render cleanly on Cmd+P → Save as
// PDF — minimal chrome, A4-friendly width, system font fallback for the
// PDF print engine. Auth-gated (only project members can access).
export default async function ProjectReportPage({
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
    .select("id, name, payload, primary_currency, secondary_currency, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const primary =
    (project.primary_currency as string | null) ?? DEFAULT_PRIMARY_CURRENCY;
  const primaryInfo = getCurrency(primary);
  const secondary = project.secondary_currency as string | null;
  const secondaryInfo = secondary ? getCurrency(secondary) : null;

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

  const transfers = calculateTransfers(people, expenses);
  const personalCosts = calculatePersonalCosts(people, expenses);
  const totalAmount = getTotalAmount(expenses);

  const nameOf = (personId: string): string =>
    people.find((p) => p.id === personId)?.name ?? "Участник";

  // Aggregate by category.
  const categoryTotalsMap = new Map<string, number>();
  for (const e of expenses) {
    const cat =
      e.category && isCategoryId(e.category) ? e.category : DEFAULT_CATEGORY;
    categoryTotalsMap.set(
      cat,
      (categoryTotalsMap.get(cat) ?? 0) + toPrimary(e),
    );
  }
  const categoryTotals = CATEGORIES.map((c) => ({
    category: c,
    amount: Math.round((categoryTotalsMap.get(c.id) ?? 0) * 100) / 100,
  })).filter((row) => row.amount > 0);

  // Paid by each person, in primary.
  const paidMap = new Map<string, number>();
  for (const e of expenses) {
    paidMap.set(e.payerId, (paidMap.get(e.payerId) ?? 0) + toPrimary(e));
  }

  return (
    <main className="mx-auto w-full max-w-[800px] px-6 sm:px-10 py-10 bg-white text-ink print:py-6 print:px-8">
      {/* Print helper bar — hidden when printing. */}
      <div className="flex items-center justify-between gap-4 mb-8 print:hidden">
        <p className="text-[0.85rem] text-muted">
          Отчёт по проекту. Нажмите <kbd className="px-1.5 py-0.5 border border-line rounded-[4px] text-[0.78rem] font-mono">⌘P</kbd> или <kbd className="px-1.5 py-0.5 border border-line rounded-[4px] text-[0.78rem] font-mono">Ctrl+P</kbd> и выберите «Сохранить как PDF».
        </p>
        <a
          href={`/app/projects/${project.id}`}
          className="text-[0.85rem] text-accent hover:text-accent-dark font-semibold"
        >
          ← Назад к проекту
        </a>
      </div>

      {/* Header */}
      <header className="mb-8 pb-6 border-b border-line">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted mb-2">
          Отчёт по проекту
        </p>
        <h1 className="text-[2rem] font-bold tracking-[-0.025em] leading-tight">
          {project.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[0.85rem] text-muted">
          <span>
            Валюта расчётов:{" "}
            <strong className="text-ink">
              {primary}
              {primaryInfo ? ` (${primaryInfo.symbol})` : ""}
            </strong>
            {secondary && secondaryInfo
              ? ` · доп.: ${secondary} (${secondaryInfo.symbol})`
              : ""}
          </span>
          <span>Обновлён: {formatDate(project.updated_at)}</span>
          <span>
            Участников: <strong className="text-ink">{people.length}</strong> ·
            Трат: <strong className="text-ink">{expenses.length}</strong>
          </span>
        </div>
      </header>

      {/* Total */}
      <section className="mb-8">
        <p className="text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-muted mb-1">
          Всего потрачено
        </p>
        <p className="text-[2.4rem] font-bold tracking-[-0.02em] font-mono tabular-nums">
          {formatMoney(totalAmount, primary, { compact: true })}
        </p>
      </section>

      {/* Transfers */}
      <section className="mb-8">
        <h2 className="text-[1.15rem] font-bold tracking-[-0.01em] mb-3">
          Переводы
        </h2>
        {transfers.length === 0 ? (
          <p className="text-[0.95rem] text-muted">
            Никому ничего не должны — расчёты сошлись.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2 pr-3 text-[0.82rem] font-semibold text-muted uppercase tracking-[0.05em]">
                  От
                </th>
                <th className="py-2 px-3 text-[0.82rem] font-semibold text-muted uppercase tracking-[0.05em]">
                  Кому
                </th>
                <th className="py-2 pl-3 text-right text-[0.82rem] font-semibold text-muted uppercase tracking-[0.05em]">
                  Сумма
                </th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr
                  key={`${t.from}-${t.to}-${t.amount}`}
                  className="border-b border-line/60"
                >
                  <td className="py-2 pr-3 text-[0.95rem]">{nameOf(t.from)}</td>
                  <td className="py-2 px-3 text-[0.95rem]">{nameOf(t.to)}</td>
                  <td className="py-2 pl-3 text-right font-mono tabular-nums font-semibold">
                    {formatMoney(t.amount, primary, { compact: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Categories */}
      {categoryTotals.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-[1.15rem] font-bold tracking-[-0.01em] mb-3">
            По категориям
          </h2>
          <table className="w-full border-collapse">
            <tbody>
              {categoryTotals.map(({ category, amount }) => (
                <tr key={category.id} className="border-b border-line/60">
                  <td className="py-2 pr-3 text-[0.95rem]">
                    <span className="mr-1.5" aria-hidden="true">
                      {category.emoji}
                    </span>
                    {category.name_ru}
                  </td>
                  <td className="py-2 pl-3 text-right font-mono tabular-nums font-semibold">
                    {formatMoney(amount, primary, { compact: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {/* Per-person paid */}
      {people.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-[1.15rem] font-bold tracking-[-0.01em] mb-3">
            Кто сколько оплатил и должен
          </h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2 pr-3 text-[0.82rem] font-semibold text-muted uppercase tracking-[0.05em]">
                  Участник
                </th>
                <th className="py-2 px-3 text-right text-[0.82rem] font-semibold text-muted uppercase tracking-[0.05em]">
                  Оплатил
                </th>
                <th className="py-2 pl-3 text-right text-[0.82rem] font-semibold text-muted uppercase tracking-[0.05em]">
                  Доля
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const paid =
                  Math.round((paidMap.get(p.id) ?? 0) * 100) / 100;
                const share =
                  personalCosts.find((c) => c.personId === p.id)?.amount ?? 0;
                return (
                  <tr key={p.id} className="border-b border-line/60">
                    <td className="py-2 pr-3 text-[0.95rem]">{p.name}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {formatMoney(paid, primary, { compact: true })}
                    </td>
                    <td className="py-2 pl-3 text-right font-mono tabular-nums">
                      {formatMoney(share, primary, { compact: true })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {/* Full expense list */}
      {expenses.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-[1.15rem] font-bold tracking-[-0.01em] mb-3">
            Все траты
          </h2>
          <table className="w-full border-collapse text-[0.88rem]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2 pr-2 text-[0.78rem] font-semibold text-muted uppercase tracking-[0.05em]">
                  Дата
                </th>
                <th className="py-2 px-2 text-[0.78rem] font-semibold text-muted uppercase tracking-[0.05em]">
                  Название
                </th>
                <th className="py-2 px-2 text-[0.78rem] font-semibold text-muted uppercase tracking-[0.05em]">
                  Категория
                </th>
                <th className="py-2 px-2 text-[0.78rem] font-semibold text-muted uppercase tracking-[0.05em]">
                  Плательщик
                </th>
                <th className="py-2 pl-2 text-right text-[0.78rem] font-semibold text-muted uppercase tracking-[0.05em]">
                  Сумма
                </th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const cat = getCategory(e.category);
                const code = e.currency ?? primary;
                const isSecondary = code !== primary;
                return (
                  <tr key={e.id} className="border-b border-line/60 align-top">
                    <td className="py-2 pr-2 whitespace-nowrap text-muted">
                      {formatDate(e.createdAt)}
                    </td>
                    <td className="py-2 px-2">{e.name}</td>
                    <td className="py-2 px-2">
                      <span aria-hidden="true">{cat.emoji}</span> {cat.name_ru}
                    </td>
                    <td className="py-2 px-2">{nameOf(e.payerId)}</td>
                    <td className="py-2 pl-2 text-right font-mono tabular-nums">
                      {formatMoney(e.amount, code, { compact: true })}
                      {isSecondary ? (
                        <span className="block text-[0.72rem] text-muted">
                          ≈{" "}
                          {formatMoney(toPrimary(e), primary, {
                            compact: true,
                          })}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      <footer className="mt-12 pt-4 border-t border-line text-center text-[0.78rem] text-muted">
        Скинуться. · отчёт сгенерирован{" "}
        {new Date().toLocaleString("ru-RU", {
          dateStyle: "long",
          timeStyle: "short",
        })}
      </footer>
    </main>
  );
}
