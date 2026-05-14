import Link from "next/link";
import { Brand } from "@/components/brand";

export default function PrivacyPage() {
  return (
    <main className="placeholder-page">
      <Brand />
      <section className="placeholder-panel">
        <p className="eyebrow">Документ</p>
        <h1>Политика конфиденциальности</h1>
        <p>Заглушка. Полный текст добавим перед публичным запуском авторизации и личного кабинета.</p>
        <Link className="ghost-button hero-button" href="/">
          На главную
        </Link>
      </section>
    </main>
  );
}
