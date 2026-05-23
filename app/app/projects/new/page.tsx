import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/app-header/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createProject } from "../actions";
import { CURRENCIES, DEFAULT_PRIMARY_CURRENCY } from "@/lib/currencies";

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

        <form
          action={createProject}
          className="grid gap-4 mt-2"
        >
          <label className="grid gap-1.5">
            <span className="text-[0.82rem] font-medium text-muted">
              Название
            </span>
            <Input
              name="name"
              type="text"
              required
              maxLength={120}
              placeholder="Тбилиси · март"
              autoComplete="off"
              autoFocus
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="text-[0.82rem] font-medium text-muted">
                Основная валюта
              </span>
              <Select name="primary" defaultValue={DEFAULT_PRIMARY_CURRENCY} required>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name_ru}
                  </option>
                ))}
              </Select>
              <span className="text-[0.78rem] text-muted">
                В этой валюте отображаются итоги
              </span>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[0.82rem] font-medium text-muted">
                Дополнительная валюта
              </span>
              <Select name="secondary" defaultValue="">
                <option value="">— Не нужна</option>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name_ru}
                  </option>
                ))}
              </Select>
              <span className="text-[0.78rem] text-muted">
                Изменить потом нельзя — выберите сейчас
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button type="submit" variant="primary" size="cta">
              Создать проект
            </Button>
            <Link
              href="/app/projects"
              className="inline-flex items-center h-11 sm:h-10 px-3 text-[0.92rem] font-semibold text-muted hover:text-ink transition-colors"
            >
              Отмена
            </Link>
          </div>
        </form>
      </Card>
    </main>
  );
}
