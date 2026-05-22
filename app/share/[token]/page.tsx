import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  calculateTransfers,
  getTotalAmount,
  type Expense,
  type Person,
} from "@/lib/split-calculator";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

function money(value: number): string {
  return currency.format(value).replace(",00", "");
}

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

  // Reject malformed tokens early — saves a DB round-trip and avoids
  // leaking even "found vs not found" timing on garbage input.
  if (!UUID_RE.test(token)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();

  // SECURITY DEFINER RPC bypasses RLS, returns a single row or nothing.
  // Available to anon/authenticated alike — public by design.
  const { data, error } = await supabase.rpc("get_public_project_summary", {
    p_token: token,
  });

  if (error || !data || data.length === 0) {
    notFound();
  }

  const row = data[0];
  const payload = (row.payload ?? {}) as PublicPayload;

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
    <main className="placeholder-page">
      <header className="topbar">
        <Brand />
        <Link href="/auth/sign-up" className="nav-button">
          Создать свой расчёт
        </Link>
      </header>

      <section className="placeholder-panel">
        <p className="eyebrow">Публичный итог</p>
        <h1>{row.name}</h1>
        <p>Обновлён {formatDate(row.updated_at)}</p>
      </section>

      <section className="placeholder-panel summary-panel">
        <h2>Итог</h2>
        <p className="details-total">
          <strong>Всего потрачено:</strong> <span>{money(totalAmount)}</span>
        </p>

        {transfers.length === 0 ? (
          <div className="empty-state">
            <strong>Все в нуле</strong>
            <span>Никому ничего не должны.</span>
          </div>
        ) : (
          <div className="summary-list">
            {transfers.map((t) => (
              <article
                key={`${t.from}-${t.to}-${t.amount}`}
                className="summary-item"
              >
                <div className="summary-main">
                  <strong>
                    {nameOf(t.from)} → {nameOf(t.to)}
                  </strong>
                  <span className="money">{money(t.amount)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="placeholder-panel">
        <p>
          Это снимок расчёта на момент {formatDate(row.updated_at)}. Чтобы
          вести свои проекты — заведите аккаунт, это бесплатно.
        </p>
        <Link href="/auth/sign-up" className="primary-button hero-button">
          Создать аккаунт
        </Link>
      </section>
    </main>
  );
}
