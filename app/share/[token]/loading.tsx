import { Brand } from "@/components/brand";

// Скелетон для /share/[token] — публичный read-only итог. Та же
// мотивация что у /p/[token]/loading.tsx: серверный RPC к Supabase
// блокирует рендер до получения данных, и на cold-start Free-tier
// контейнер может ждать 5-15 секунд. Структура повторяет реальную
// страницу (max-width 640, hero / total / transfers).
export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-[640px] px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-16"
      aria-busy="true"
      aria-live="polite"
    >
      <header className="flex items-center justify-between gap-3 mb-8">
        <Brand href="/" />
        <SkeletonBlock className="h-9 w-40 rounded-control" />
      </header>

      <section className="grid gap-6">
        <div>
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="mt-3 h-10 w-3/4" />
          <div className="flex flex-wrap gap-2 mt-3">
            <SkeletonBlock className="h-6 w-16 rounded-full" />
            <SkeletonBlock className="h-4 w-36" />
          </div>
        </div>

        <div className="rounded-card p-6 bg-white border border-line shadow-xs">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="mt-3 h-12 w-1/2" />
        </div>

        <div>
          <SkeletonBlock className="h-5 w-36 mb-3" />
          <div className="grid gap-2">
            <SkeletonBlock className="h-14 w-full rounded-card" />
            <SkeletonBlock className="h-14 w-full rounded-card" />
            <SkeletonBlock className="h-14 w-full rounded-card" />
          </div>
        </div>
      </section>
    </main>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[#F4F4F1] ${className}`.trim()}
    />
  );
}
