"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

const projectIdSchema = z.object({
  projectId: z.string().uuid(),
});

// Generates a fresh share_token (uuid) for the project. RLS on
// app_projects.UPDATE requires editor or owner, so non-members and
// viewers cannot enable sharing.
//
// If a token already existed, it's overwritten — useful for rotating.
export async function enableShare(formData: FormData): Promise<void> {
  const parsed = projectIdSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) throw new Error("Некорректный id");

  const { supabase } = await requireUser();

  const newToken = crypto.randomUUID();

  const { error } = await supabase
    .from("app_projects")
    .update({ share_token: newToken })
    .eq("id", parsed.data.projectId);

  if (error) throw new Error(error.message);

  revalidatePath(`/app/projects/${parsed.data.projectId}`);
}

// Removes the share_token. Existing public links stop working.
export async function disableShare(formData: FormData): Promise<void> {
  const parsed = projectIdSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) throw new Error("Некорректный id");

  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("app_projects")
    .update({ share_token: null })
    .eq("id", parsed.data.projectId);

  if (error) throw new Error(error.message);

  revalidatePath(`/app/projects/${parsed.data.projectId}`);
}
