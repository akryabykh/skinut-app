import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listProjectMembers } from "../members-actions";
import { ROLE_LABEL_RU } from "../members-state";
import { ProjectManagement } from "./project-management";

type Params = Promise<{ id: string }>;

export default async function ProjectDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: project } = await supabase
    .from("app_projects")
    .select("id, name, share_token")
    .eq("id", id)
    .maybeSingle();

  // notFound covers both "doesn't exist" and "RLS hid it because you
  // aren't a member" — both look the same to the user and that's fine.
  if (!project) {
    notFound();
  }

  const members = await listProjectMembers(project.id);
  const myMembership = members.find((m) => m.user_id === user.id);
  if (!myMembership) {
    notFound();
  }

  return (
    <main className="placeholder-page">
      <header className="topbar">
        <Brand />
        <Link href="/app/projects" className="nav-button">
          ← К проектам
        </Link>
      </header>

      <section className="placeholder-panel">
        <p className="eyebrow">Проект</p>
        <h1>{project.name}</h1>
        <p>
          Ваша роль: <strong>{ROLE_LABEL_RU[myMembership.role]}</strong>
        </p>
        <Link
          href={`/app?project=${project.id}`}
          className="primary-button hero-button"
        >
          Открыть калькулятор
        </Link>
      </section>

      <ProjectManagement
        projectId={project.id}
        shareToken={project.share_token}
        members={members}
        currentUserId={user.id}
        myRole={myMembership.role}
      />
    </main>
  );
}
