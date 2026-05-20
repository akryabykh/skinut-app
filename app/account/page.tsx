import { redirect } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "../auth/actions";
import { AccountForm } from "./account-form";

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

  const email = user.email ?? "—";
  const fallbackName =
    user.email && user.email.includes("@")
      ? user.email.split("@")[0]
      : "Пользователь";
  const displayName = profile?.display_name ?? fallbackName;

  return (
    <main className="placeholder-page">
      <header className="topbar">
        <Brand />
        <Link href="/app/projects" className="nav-button">
          Мои проекты
        </Link>
      </header>

      <section className="placeholder-panel">
        <p className="eyebrow">Личный кабинет</p>
        <h1>Здравствуйте, {displayName}</h1>

        <dl className="account-info">
          <div>
            <dt>Email</dt>
            <dd>{email}</dd>
          </div>
        </dl>

        <AccountForm initialDisplayName={displayName} email={email} />

        <form action={signOut} className="account-signout">
          <button type="submit" className="ghost-button hero-button">
            Выйти из аккаунта
          </button>
        </form>
      </section>
    </main>
  );
}
