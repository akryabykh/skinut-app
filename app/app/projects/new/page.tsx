import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/app-header/app-header";
import { Card } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewProjectForm } from "./new-project-form";

// /app/projects/new
//
// Real form: project name + main currency (required) + secondary currency
// (optional). Submit triggers the createProject server action which
// redirects to /app?project=<id> on success.
export default async function NewProjectPage() {
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
  const email = user.email ?? profile?.email ?? "—";
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
        active="projects"
      />

      <Link
        href="/app/projects"
        className="inline-flex items-center gap-1.5 mb-4 text-[0.88rem] font-semibold text-muted hover:text-ink transition-colors"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        <span>К списку проектов</span>
      </Link>

      <Card className="!p-6">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted mb-2">
          Новый проект
        </p>
        <h1 className="text-[2rem] font-bold tracking-[-0.025em] text-ink leading-tight mb-2">
          Заведём расчёт
        </h1>
        <p className="text-[0.95rem] text-muted leading-snug mb-6">
          Назовите проект, выберите основную валюту — итоги переводов будут
          считаться в ней. Можно добавить вторую валюту, если часть трат
          будет в другой стране.
        </p>

        <NewProjectForm />
      </Card>
    </main>
  );
}
