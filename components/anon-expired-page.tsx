import Link from "next/link";
import { Clock } from "lucide-react";

/**
 * Страница «410 Gone» для просроченных или несуществующих анон-проектов.
 * Технически Next.js рендерит 200 OK с этим контентом — статус-код
 * для SEO неважен (URL-uuid непубличные, не индексируются), важно
 * человеческое сообщение и CTA на создание нового.
 */
export function AnonExpiredPage() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-5 sm:px-8 pt-[calc(env(safe-area-inset-top)+48px)] pb-16">
      <div className="rounded-card border border-line bg-white p-8 sm:p-10 text-center shadow-xs">
        <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#F4F4F1] text-muted">
          <Clock size={24} aria-hidden="true" />
        </div>
        <h1 className="text-[1.5rem] sm:text-[1.7rem] font-bold tracking-[-0.02em] text-ink leading-tight">
          Расчёт больше недоступен
        </h1>
        <p className="mt-3 text-[0.95rem] text-muted leading-snug">
          Этот анонимный расчёт удалён, потому что прошло 30 дней
          с последней правки. Локальные расчёты живут пока с ними
          работают — это позволяет нам не хранить данные вечно.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
          <Link
            href="/app"
            className="inline-flex items-center justify-center h-11 sm:h-12 px-5 rounded-control bg-accent text-white font-semibold text-[0.95rem] hover:bg-accent-dark transition-colors"
          >
            Начать новый расчёт
          </Link>
          <Link
            href="/auth/sign-up"
            className="inline-flex items-center justify-center h-11 sm:h-12 px-5 rounded-control border border-line bg-white text-ink font-semibold text-[0.95rem] hover:bg-[#F4F4F1] transition-colors"
          >
            Зарегистрироваться
          </Link>
        </div>
        <p className="mt-4 text-[0.8rem] text-muted">
          С аккаунтом проекты хранятся бессрочно и доступны с любого устройства.
        </p>
      </div>
    </main>
  );
}
