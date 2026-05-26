import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ReceiptText,
  Share2,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user);

  return (
    <main className="mx-auto w-full max-w-[1160px] px-5 sm:px-8 pt-[calc(env(safe-area-inset-top)+24px)] pb-16">
      <header className="flex items-center justify-between gap-4 py-2">
        <Brand />
        <nav
          className="flex items-center gap-1 sm:gap-2"
          aria-label="Основная навигация"
        >
          {isAuthenticated ? (
            <>
              <Link
                href="/app/projects"
                className="hidden sm:inline-flex items-center h-10 px-3 text-[0.92rem] font-semibold text-ink hover:text-accent transition-colors"
              >
                Мои проекты
              </Link>
              <LinkButton href="/account" variant="secondary" size="sm">
                Личный кабинет
              </LinkButton>
            </>
          ) : (
            <>
              <Link
                href="/auth/sign-in"
                className="inline-flex items-center h-10 px-3 text-[0.92rem] font-semibold text-ink hover:text-accent transition-colors"
              >
                Войти
              </Link>
              <LinkButton href="/auth/sign-up" variant="primary" size="sm">
                Регистрация
              </LinkButton>
            </>
          )}
        </nav>
      </header>

      <section className="grid lg:grid-cols-[1.05fr_0.95fr] items-center gap-12 lg:gap-16 pt-10 sm:pt-16 pb-16 sm:pb-24">
        <div className="space-y-6">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-accent">
            Трип-мани без таблиц
          </p>
          <h1 className="text-[2.4rem] sm:text-[3.1rem] lg:text-[3.6rem] font-bold leading-[1.02] tracking-[-0.025em] text-ink">
            Делите расходы в&nbsp;поездках{" "}
            <span className="text-muted">спокойно и&nbsp;понятно</span>
          </h1>
          <p className="text-[1.05rem] sm:text-[1.15rem] leading-[1.55] text-muted max-w-[540px]">
            Добавляйте участников, фиксируйте покупки и сразу получайте
            простой список переводов: кто кому и сколько должен.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <LinkButton
              href={isAuthenticated ? "/app/projects" : "/auth/sign-up"}
              variant="primary"
              size="cta"
            >
              <span>{isAuthenticated ? "Мои проекты" : "Начать"}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </LinkButton>
            {isAuthenticated ? (
              <LinkButton href="/app" variant="secondary" size="cta">
                Открыть калькулятор
              </LinkButton>
            ) : (
              <LinkButton href="/app" variant="secondary" size="cta">
                <span>Просто посчитать</span>
                <ArrowRight size={18} aria-hidden="true" />
              </LinkButton>
            )}
          </div>
          <p className="text-[0.85rem] text-muted pt-1">
            {isAuthenticated
              ? "Без рекламы. Данные хранятся только у вас."
              : "Без рекламы. Считать можно без регистрации — расчёт сохранится в браузере."}
          </p>
        </div>

        <HeroMockup />
      </section>

      <section aria-labelledby="howTitle" className="pt-4 pb-20">
        <div className="max-w-[640px] mb-8 sm:mb-10">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted mb-3">
            Как это работает
          </p>
          <h2
            id="howTitle"
            className="!inline text-[1.8rem] sm:text-[2.15rem] font-bold leading-[1.1] tracking-[-0.02em] text-ink"
          >
            Четыре шага вместо споров в&nbsp;чате
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FeatureCard
            icon={<UsersRound size={18} aria-hidden="true" />}
            title="Создайте группу"
            description="Добавьте людей, между которыми нужно разделить расходы."
          />
          <FeatureCard
            icon={<Share2 size={18} aria-hidden="true" />}
            title="Поделитесь ссылкой"
            description="Откройте один расчёт на телефонах участников."
          />
          <FeatureCard
            icon={<ReceiptText size={18} aria-hidden="true" />}
            title="Вносите траты"
            description="Укажите покупку, сумму, плательщика и участников."
          />
          <FeatureCard
            icon={<CheckCircle2 size={18} aria-hidden="true" />}
            title="Получите переводы"
            description="Приложение само посчитает минимальные взаиморасчёты."
          />
        </div>
      </section>

      <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-6 border-t border-line text-[0.88rem] text-muted">
        <span>© 2026 Скинуться.</span>
        <Link
          href="/privacy"
          className="hover:text-ink transition-colors"
        >
          Политика конфиденциальности
        </Link>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="!p-5">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-control bg-[#F4F4F1] text-ink mb-4">
        {icon}
      </div>
      <h3 className="text-[1rem] font-semibold text-ink leading-snug tracking-[-0.01em]">
        {title}
      </h3>
      <p className="mt-2 text-[0.92rem] leading-[1.45] text-muted">
        {description}
      </p>
    </Card>
  );
}

function HeroMockup() {
  return (
    <div className="relative w-full max-w-[460px] mx-auto lg:ml-auto">
      <Card className="!p-5 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">
              Проект
            </p>
            <p className="text-[1.05rem] font-bold text-ink mt-0.5 tracking-[-0.01em] truncate">
              Тбилиси · март
            </p>
          </div>
          <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-accent-soft text-accent-dark text-[0.72rem] font-semibold uppercase tracking-[0.06em] whitespace-nowrap">
            5 человек
          </span>
        </div>
        <ul className="space-y-0 mb-4">
          <ExpenseRow
            title="Такси из аэропорта"
            amount="1 240"
            payerLabel="Заплатила Алия"
          />
          <ExpenseRow
            title="Ужин в хинкальной"
            amount="6 850"
            payerLabel="Заплатил Иван"
          />
          <ExpenseRow
            title="Гид по старому городу"
            amount="3 200"
            payerLabel="Заплатила Алия"
          />
        </ul>
        <div className="rounded-card bg-[#F4F4F1] p-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted mb-2.5">
            Итог
          </p>
          <div className="space-y-2">
            <SettleRow from="Сергей" to="Алия" amount="2 718" />
            <SettleRow from="Маша" to="Иван" amount="1 370" />
          </div>
        </div>
      </Card>
      {/* Decorative accent badge */}
      <div
        aria-hidden="true"
        className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 hidden md:flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-md rotate-3"
      >
        <CheckCircle2 size={22} strokeWidth={2.4} />
      </div>
    </div>
  );
}

function ExpenseRow({
  title,
  amount,
  payerLabel,
}: {
  title: string;
  amount: string;
  payerLabel: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 border-b border-line last:border-b-0">
      <div className="min-w-0">
        <p className="text-[0.93rem] font-semibold text-ink truncate">
          {title}
        </p>
        <p className="text-[0.78rem] text-muted">{payerLabel}</p>
      </div>
      <p className="font-mono tabular-nums font-semibold text-ink whitespace-nowrap text-[0.95rem]">
        {amount}&nbsp;₽
      </p>
    </li>
  );
}

function SettleRow({
  from,
  to,
  amount,
}: {
  from: string;
  to: string;
  amount: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[0.95rem]">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-semibold text-ink truncate">{from}</span>
        <ArrowRight
          size={14}
          aria-hidden="true"
          className="text-muted shrink-0"
        />
        <span className="font-semibold text-ink truncate">{to}</span>
      </div>
      <span className="font-mono tabular-nums font-bold text-accent whitespace-nowrap">
        {amount}&nbsp;₽
      </span>
    </div>
  );
}
