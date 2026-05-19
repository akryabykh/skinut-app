import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createProject, deleteProject } from "./actions";

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

  // RLS already filters by owner_id, but we also pass it explicitly
  // — defence in depth.
  const { data: projects } = await supabase
    .from("app_projects")
    .select("id, name, updated_at")
    .eq("owner_id", user.id)
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

        <form action={createProject} className="projects-create">
          <button type="submit" className="primary-button hero-button">
            + Создать новый проект
          </button>
        </form>

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
                <form action={deleteProject} className="projects-delete">
                  <input type="hidden" name="id" value={project.id} />
                  <button
                    type="submit"
                    className="ghost-button danger projects-delete-button"
                    aria-label={`Удалить «${project.name}»`}
                  >
                    Удалить
                  </button>
                </form>
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
