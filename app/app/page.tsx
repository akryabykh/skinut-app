import { ExpenseCalculator } from "@/components/expense-calculator";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchParams = Record<string, string | string[] | undefined>;

type AppPageProps = {
  searchParams?: Promise<SearchParams>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AppPage({ searchParams }: AppPageProps) {
  const params: SearchParams = searchParams ? await searchParams : {};
  const projectId = firstParam(params.project);

  // Guest mode: no project param → calculator uses localStorage.
  if (!projectId) {
    return <ExpenseCalculator />;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Tried to open a project link without auth — fall back to guest mode.
  if (!user) {
    return <ExpenseCalculator />;
  }

  // RLS filters by membership now; if the user isn't a member we get null.
  const { data: project } = await supabase
    .from("app_projects")
    .select("id, name, payload")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return <ExpenseCalculator />;
  }

  // Determine current user's role so we can switch the calculator into
  // read-only mode for viewers. RLS already restricts the row above, so
  // this query is just for the role, not for access control.
  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", project.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const canEdit =
    membership?.role === "owner" || membership?.role === "editor";

  return (
    <ExpenseCalculator
      projectId={project.id}
      initialName={project.name}
      initialPayload={project.payload as never}
      canEdit={canEdit}
    />
  );
}
