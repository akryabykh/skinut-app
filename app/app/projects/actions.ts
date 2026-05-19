"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Helper: ensures we have a Supabase client and a logged-in user.
// If the user isn't logged in, redirects to sign-in (NEXT_REDIRECT thrown).
async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in");
  }
  return { supabase, user };
}

// Creates an empty project owned by the current user and redirects
// to the calculator pointing at it. Used by:
//   - the "+ Создать" button on /app/projects
//   - the /app/projects/new page
export async function createProject() {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("app_projects")
    .insert({
      owner_id: user.id,
      name: "Новый проект",
      payload: {},
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Не удалось создать проект");
  }

  revalidatePath("/app/projects");
  redirect(`/app?project=${data.id}`);
}

const renameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Название обязательно").max(120, "Слишком длинное"),
});

export async function renameProject(formData: FormData) {
  const parsed = renameSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
  }

  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("app_projects")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app/projects");
}

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function deleteProject(formData: FormData) {
  const parsed = deleteSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) {
    throw new Error("Некорректный id");
  }

  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("app_projects")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app/projects");
}

// Save the calculator's JSON state into the project row.
// Called from the client component on debounced state changes.
// Returns the new updated_at so the client can show "saved at".
//
// If payload contains projectName (which the calculator writes into it),
// it's also mirrored into the row's `name` column. That keeps the list
// view at /app/projects in sync with the title shown inside the calc.
export async function saveProjectPayload(
  id: string,
  payload: unknown,
): Promise<{ updatedAt: string }> {
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Некорректный id");
  }

  const { supabase } = await requireUser();

  const update: { payload: unknown; name?: string } = { payload };
  if (
    typeof payload === "object" &&
    payload !== null &&
    "projectName" in payload
  ) {
    const candidate = (payload as { projectName: unknown }).projectName;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      update.name = candidate.trim();
    }
  }

  const { data, error } = await supabase
    .from("app_projects")
    .update(update as never)
    .eq("id", id)
    .select("updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Не удалось сохранить");
  }

  return { updatedAt: data.updated_at };
}
