import { redirect } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <main className="mx-auto w-full max-w-[640px] px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-16">
      <header className="flex items-center justify-between gap-3 mb-8">
        <Brand href="/" />
        <Link
          href="/app/projects"
          className="inline-flex items-center h-10 px-3 text-[0.92rem] font-semibold text-ink hover:text-accent transition-colors"
        >
          Мои проекты
        </Link>
      </header>

      <section className="grid gap-6">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted mb-2">
            Личный кабинет
          </p>
          <h1 className="text-[2rem] sm:text-[2.4rem] font-bold tracking-[-0.025em] text-ink leading-tight">
            Здравствуйте, {displayName}
          </h1>
        </div>

        <Card variant="muted" className="!p-5">
          <p className="text-[0.78rem] font-medium text-muted mb-1">Email</p>
          <p className="text-[1rem] font-semibold text-ink break-all">{email}</p>
        </Card>

        <Card className="!p-6">
          <h2 className="text-[1.1rem] font-bold tracking-[-0.01em] text-ink mb-1">
            Профиль
          </h2>
          <p className="text-[0.9rem] text-muted leading-snug mb-4">
            Имя видят участники ваших проектов.
          </p>
          <AccountForm initialDisplayName={displayName} email={email} />
        </Card>

        <form action={signOut}>
          <Button type="submit" variant="secondary" size="md">
            Выйти из аккаунта
          </Button>
        </form>
      </section>
    </main>
  );
}
