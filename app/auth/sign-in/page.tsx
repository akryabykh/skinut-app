import Link from "next/link";
import { Brand } from "@/components/brand";

export default function SignInPlaceholderPage() {
  return (
    <main className="placeholder-page">
      <Brand />
      <section className="placeholder-panel">
        <p className="eyebrow">Следующий блок</p>
        <h1>Вход появится на следующем шаге</h1>
        <p>Сейчас мы перенесли приложение на Next.js. Дальше подключим Supabase Auth: email, код подтверждения и пароль.</p>
        <Link className="primary-button hero-button" href="/app">
          Открыть калькулятор
        </Link>
      </section>
    </main>
  );
}
