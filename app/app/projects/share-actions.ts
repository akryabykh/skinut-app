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

// One-click variant for the calculator's «Поделиться» button: if the
// project already has a share_token, return it as-is. Otherwise mint a
// fresh uuid, persist it, and return that. RLS still enforces that only
// editor/owner can write — viewers will get an error from the update
// branch and the button hides for them on the client anyway.
export async function ensureShareToken(projectId: string): Promise<string> {
  const parsed = projectIdSchema.safeParse({ projectId });
  if (!parsed.success) throw new Error("Некорректный id");

  const { supabase } = await requireUser();

  // Fast-path: token already there.
  const { data: existing, error: readError } = await supabase
    .from("app_projects")
    .select("share_token")
    .eq("id", parsed.data.projectId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing?.share_token) return existing.share_token;

  // Need to mint a token. RLS UPDATE policy gates editor/owner.
  const newToken = crypto.randomUUID();
  const { error: writeError } = await supabase
    .from("app_projects")
    .update({ share_token: newToken })
    .eq("id", parsed.data.projectId);
  if (writeError) throw new Error(writeError.message);

  revalidatePath(`/app/projects/${parsed.data.projectId}`);
  return newToken;
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

// Block 14: edit-by-link. Mints a fresh edit_token uuid on the owned
// project, so a `/p/<token>` URL becomes editable by anyone with it.
// RLS UPDATE policy gates this to owner/editor — viewers can't enable.
// Overwrites prior token if one existed (works as "rotate / revoke").
export async function enableEditLink(formData: FormData): Promise<void> {
  const parsed = projectIdSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) throw new Error("Некорректный id");

  const { supabase } = await requireUser();

  const newToken = crypto.randomUUID();
  const { error } = await supabase
    .from("app_projects")
    .update({ edit_token: newToken })
    .eq("id", parsed.data.projectId);

  if (error) throw new Error(error.message);

  revalidatePath(`/app/projects/${parsed.data.projectId}`);
}

// Disables edit-by-link. Existing /p/<token> URLs immediately stop
// working (404 → AnonExpiredPage on the route). Owner can re-enable
// at any time, which will mint a new (different) token.
export async function disableEditLink(formData: FormData): Promise<void> {
  const parsed = projectIdSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) throw new Error("Некорректный id");

  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("app_projects")
    .update({ edit_token: null })
    .eq("id", parsed.data.projectId);

  if (error) throw new Error(error.message);

  revalidatePath(`/app/projects/${parsed.data.projectId}`);
}
