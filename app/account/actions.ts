"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AccountFormState } from "./state";

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

const displayNameSchema = z.object({
  displayName: z
    .string()
    .min(1, "Имя не может быть пустым")
    .max(64, "Слишком длинное имя"),
});

export async function updateDisplayName(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = displayNameSchema.safeParse({
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Некорректные данные",
    };
  }

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", user.id);

  if (error) {
    return { status: "error", message: error.message };
  }

  // Refresh pages that show display name.
  revalidatePath("/account");
  revalidatePath("/");
  revalidatePath("/account");

  return { status: "success", message: "Имя сохранено" };
}

// Permanently deletes the current user. Cascades:
//   - public.profiles via FK (Block 1 migration)
//   - public.app_projects via FK (Block 2 migration)
// After deletion, sign out the now-invalid session and send user home.
export async function deleteAccount(_formData?: FormData): Promise<void> {
  const { user } = await requireUser();

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(user.id);
  if (error) {
    throw new Error(error.message);
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  redirect("/");
}
