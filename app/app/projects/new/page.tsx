import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
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
//
// Block 4 reshape: this used to be a server component that called
// createProject() immediately and returned null. Now it shows a form so
// the user can pick currencies up front (the trip-to-Turkey scenario:
// primary RUB + secondary TRY).
export default async function NewProjectPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in");
  }

  return (
    <main className="placeholder-page">
      <header className="topbar">
        <Brand />
        <Link href="/account" className="nav-button">
          Назад к проектам
        </Link>
      </header>

      <section className="placeholder-panel">
        <p className="eyebrow">Новый проект</p>
        <h1>Заведём расчёт</h1>
        <p>
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
              href="/account"
              className="inline-flex items-center h-11 sm:h-10 px-3 text-[0.92rem] font-semibold text-muted hover:text-ink transition-colors"
            >
              Отмена
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
