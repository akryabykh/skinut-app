import Link from "next/link";
import { Brand } from "@/components/brand";

export default function SignUpPlaceholderPage() {
  return (
    <main className="placeholder-page">
      <Brand />
      <section className="placeholder-panel">
        <p className="eyebrow">Следующий блок</p>
        <h1>Регистрация будет подключена отдельно</h1>
        <p>На следующем этапе добавим email OTP через Supabase: письмо с кодом, имя, пароль и профиль пользователя.</p>
        <Link className="primary-button hero-button" href="/app">
          Пока начать без аккаунта
        </Link>
      </section>
    </main>
  );
}
