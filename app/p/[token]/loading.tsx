import { Brand } from "@/components/brand";

// Скелетон для /p/[token]. Next.js App Router оборачивает async page в
// <Supense fallback={loading}>, поэтому юзер видит этот макет сразу,
// пока серверный RPC к Supabase идёт. Важно для холодного старта
// Supabase Free-tier — иногда первый запрос ждёт 5-15 секунд, пока
// контейнер БД просыпается. Без loading.tsx это белый экран.
//
// Структура должна повторять реальный layout из ExpenseCalculator —
// тот же max-width, паддинги, порядок секций (баннер, название,
// участники, форма траты) — чтобы переход «скелетон → реальный
// контент» не дёргал страницу.
export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-[760px] px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-16"
      aria-busy="true"
      aria-live="polite"
    >
      <header className="flex items-center mb-6">
        <div className="grid gap-1">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted">
            Расчёт по ссылке
          </p>
          <Brand href="/" />
        </div>
      </header>

      <div className="mb-4 rounded-card border border-[#F8D4C5] bg-[#FCE9E1] p-4 sm:p-5">
        <SkeletonBlock className="h-4 w-2/3 bg-[#F8D4C5]" />
        <SkeletonBlock className="mt-2 h-3 w-1/2 bg-[#F8D4C5]" />
      </div>

      <div className="grid gap-3">
        <SkeletonCard>
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="mt-2 h-12 w-full" />
        </SkeletonCard>

        <SkeletonCard>
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-9 w-9 rounded-full" />
            <div className="grid gap-1.5">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
          </div>
          <SkeletonBlock className="mt-4 h-12 w-full" />
          <div className="mt-4 flex flex-wrap gap-2">
            <SkeletonBlock className="h-8 w-20 rounded-full" />
            <SkeletonBlock className="h-8 w-24 rounded-full" />
            <SkeletonBlock className="h-8 w-16 rounded-full" />
          </div>
        </SkeletonCard>

        <SkeletonCard>
          <div className="flex items-center gap-3 mb-4">
            <SkeletonBlock className="h-9 w-9 rounded-card" />
            <div className="grid gap-1.5">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-3 w-44" />
            </div>
          </div>
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="mt-2 h-12 w-full" />
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <div>
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="mt-2 h-12 w-full" />
            </div>
            <div>
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="mt-2 h-12 w-full" />
            </div>
          </div>
        </SkeletonCard>
      </div>
    </main>
  );
}

function SkeletonCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card p-5 bg-white border border-line shadow-xs">
      {children}
    </div>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[#F4F4F1] ${className}`.trim()}
    />
  );
}
