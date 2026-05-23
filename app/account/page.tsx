import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header/app-header";
import { Card } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccountForm } from "./account-form";
import { DeleteAccountSection } from "./delete-account-section";

// Block 12: /account is back to a profile-only page. Projects list lives
// at /app/projects again. The "Внимание" (delete account) card sits at
// the bottom of the page.
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
    .select("display_name, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const email = user.email ?? "—";
  const fallbackName =
    user.email && user.email.includes("@")
      ? user.email.split("@")[0]
      : "Пользователь";
  const displayName = profile?.display_name ?? fallbackName;
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-16">
      <AppHeader
        displayName={displayName}
        avatarUrl={avatarUrl}
        email={email}
        active="account"
      />

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
      </section>

      {/* Pinned at the bottom so it never dominates the everyday profile flow. */}
      <section className="mt-16">
        <DeleteAccountSection email={email} />
      </section>
    </main>
  );
}
