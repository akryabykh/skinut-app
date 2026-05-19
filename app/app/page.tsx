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
  // (Could also redirect to /auth/sign-in?next=... — defer that decision.)
  if (!user) {
    return <ExpenseCalculator />;
  }

  // RLS will also enforce this, but we pass owner_id explicitly for clarity.
  const { data: project } = await supabase
    .from("app_projects")
    .select("id, name, payload")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) {
    // Not found or belongs to a different user — render empty calculator.
    return <ExpenseCalculator />;
  }

  return (
    <ExpenseCalculator
      projectId={project.id}
      initialName={project.name}
      // The payload column is typed as Json; we trust the calculator's
      // own normalizeState() to handle missing/corrupt fields.
      initialPayload={project.payload as never}
    />
  );
}
