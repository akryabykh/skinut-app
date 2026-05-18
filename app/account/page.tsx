import { redirect } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "../auth/actions";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const fallbackName = user.email ? user.email.split("@")[0] : "Пользователь";
  const displayName = profile?.display_name ?? fallbackName;

  return (
    <main className="placeholder-page">
      <header className="topbar">
        <Brand />
        <Link href="/app" className="nav-button">
          Калькулятор
        </Link>
      </header>

      <section className="placeholder-panel">
        <p className="eyebrow">Личный кабинет</p>
        <h1>Здравствуйте, {displayName}</h1>
        <p>
          Скоро здесь появятся ваши проекты и история трат. Пока что вы можете
          пользоваться калькулятором как раньше — он сохраняет данные локально.
        </p>

        <dl className="account-info">
          <div>
            <dt>Email</dt>
            <dd>{user.email ?? "—"}</dd>
          </div>
          <div>
            <dt>Имя</dt>
            <dd>{profile?.display_name ?? "—"}</dd>
          </div>
        </dl>

        <form action={signOut}>
          <button type="submit" className="ghost-button hero-button danger">
            Выйти из аккаунта
          </button>
        </form>
      </section>
    </main>
  );
}
