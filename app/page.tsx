import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ReceiptText, Share2, UsersRound } from "lucide-react";
import { Brand } from "@/components/brand";

type SearchParams = Record<string, string | string[] | undefined>;

type HomePageProps = {
  searchParams?: Promise<SearchParams> | SearchParams;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params: SearchParams = searchParams ? await searchParams : {};
  const project = firstParam(params.project) || firstParam(params.p);
  const data = firstParam(params.data);

  if (project) {
    redirect(`/app?project=${encodeURIComponent(project)}`);
  }

  if (data) {
    redirect(`/app?data=${encodeURIComponent(data)}`);
  }

  return (
    <main className="landing-page">
      <header className="landing-header">
        <Brand />
        <nav className="landing-nav" aria-label="Основная навигация">
          <Link href="/auth/sign-in">Войти</Link>
          <Link className="nav-button" href="/auth/sign-up">
            Регистрация
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="hero-scene" aria-hidden="true">
          <Image src="/logo.svg" alt="" width={132} height={132} priority />
          <div className="visual-card visual-card-main">
            <span>Итог</span>
            <strong>Аня → Илья 2 450 ₽</strong>
          </div>
          <div className="visual-card visual-card-side">
            <span>Всего потрачено</span>
            <strong>18 900 ₽</strong>
          </div>
          <div className="visual-card visual-card-third">
            <span>Покупки</span>
            <strong>Такси · Ужин · Отель</strong>
          </div>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">Трип-мани без лишних таблиц</p>
          <h1>Делите расходы в поездке спокойно и понятно</h1>
          <p>
            Добавляйте участников, фиксируйте покупки и сразу получайте простой список переводов: кто кому и сколько должен.
          </p>
          <div className="hero-actions">
            <Link className="primary-button hero-button" href="/app">
              Старт
            </Link>
            <Link className="ghost-button hero-button" href="/auth/sign-up">
              Создать аккаунт позже
            </Link>
          </div>
        </div>
      </section>

      <section className="how-section" aria-labelledby="howTitle">
        <div className="section-heading">
          <p className="eyebrow">Как это работает</p>
          <h2 id="howTitle">Четыре шага вместо споров в чате</h2>
        </div>
        <div className="how-grid">
          <article>
            <UsersRound aria-hidden="true" />
            <h3>Создайте группу</h3>
            <p>Добавьте людей, между которыми нужно разделить расходы.</p>
          </article>
          <article>
            <Share2 aria-hidden="true" />
            <h3>Поделитесь ссылкой</h3>
            <p>Откройте один расчет на телефонах участников.</p>
          </article>
          <article>
            <ReceiptText aria-hidden="true" />
            <h3>Вносите траты</h3>
            <p>Укажите покупку, сумму, плательщика и участников.</p>
          </article>
          <article>
            <CheckCircle2 aria-hidden="true" />
            <h3>Получите переводы</h3>
            <p>Приложение само посчитает минимальные взаиморасчеты.</p>
          </article>
        </div>
      </section>

      <footer className="landing-footer">
        <span>© 2026 Скинуться</span>
        <Link href="/privacy">Политика конфиденциальности</Link>
      </footer>
    </main>
  );
}
