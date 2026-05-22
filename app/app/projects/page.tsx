import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { Brand } from "@/components/brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ProjectsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in");
  }

  // RLS now filters by project_members membership (Block 3b migration).
  // No explicit owner_id filter — viewers/editors see their projects too.
  const { data: projects } = await supabase
    .from("app_projects")
    .select("id, name, updated_at")
    .order("updated_at", { ascending: false });

  const items = projects ?? [];

  return (
    <main className="placeholder-page">
      <header className="topbar">
        <Brand />
        <Link href="/account" className="nav-button">
          Личный кабинет
        </Link>
      </header>

      <section className="placeholder-panel">
        <p className="eyebrow">Мои проекты</p>
        <h1>Расчёты, которые вы ведёте</h1>
        <p>
          Каждый проект — отдельная поездка или встреча со своим списком
          участников и трат. Все изменения сохраняются автоматически.
        </p>

        <div className="projects-create">
          <Link href="/app/projects/new" className="primary-button hero-button">
            + Создать новый проект
          </Link>
        </div>

        {items.length > 0 ? (
          <ul className="projects-list">
            {items.map((project) => (
              <li key={project.id} className="projects-item">
                <Link
                  href={`/app?project=${project.id}`}
                  className="projects-link"
                >
                  <strong>{project.name}</strong>
                  <span className="meta">
                    Обновлён {formatDate(project.updated_at)}
                  </span>
                </Link>
                <Link
                  href={`/app/projects/${project.id}`}
                  className="ghost-button projects-settings"
                  aria-label={`Настройки проекта «${project.name}»`}
                >
                  <Settings size={16} aria-hidden="true" />
                  <span>Настройки</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">
            <strong>У вас пока нет проектов.</strong>
            Нажмите «Создать новый», чтобы открыть пустой расчёт.
          </p>
        )}
      </section>
    </main>
  );
}
