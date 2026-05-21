"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberInfo, MembersFormState } from "./members-state";

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

// Lists members of a project. RLS guarantees only members of the project
// can read this. Co-member profile visibility is granted by the policy
// added in 20260521000002.
export async function listProjectMembers(
  projectId: string,
): Promise<MemberInfo[]> {
  const { supabase } = await requireUser();

  const { data: members, error } = await supabase
    .from("project_members")
    .select("user_id, role, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const ids = (members ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .in("id", ids);

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p] as const),
  );

  return (members ?? []).map((m) => {
    const profile = profileById.get(m.user_id);
    return {
      user_id: m.user_id,
      role: m.role,
      email: profile?.email ?? null,
      display_name: profile?.display_name ?? null,
      joined_at: m.created_at,
    };
  });
}

// ============================================================
// inviteMember — used with useActionState on the client
// ============================================================

const inviteSchema = z.object({
  projectId: z.string().uuid(),
  email: z.string().email("Введите корректный email"),
  // Owners are only ever set via creation trigger or transferOwnership.
  role: z.enum(["editor", "viewer"]),
});

export async function inviteMember(
  _prev: MembersFormState,
  formData: FormData,
): Promise<MembersFormState> {
  const parsed = inviteSchema.safeParse({
    projectId: formData.get("projectId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Некорректные данные",
    };
  }

  const { supabase } = await requireUser();

  // Find user by email via the SECURITY DEFINER helper.
  // Returns null if no user with this email is registered.
  const { data: foundUserId, error: lookupError } = await supabase.rpc(
    "find_user_id_by_email",
    { p_email: parsed.data.email },
  );
  if (lookupError) {
    return { status: "error", message: lookupError.message };
  }
  if (!foundUserId) {
    return {
      status: "error",
      message:
        "Пользователь с таким email не найден. Попросите его сначала зарегистрироваться.",
    };
  }

  const { error: insertError } = await supabase
    .from("project_members")
    .insert({
      project_id: parsed.data.projectId,
      user_id: foundUserId,
      role: parsed.data.role,
    });

  if (insertError) {
    // 23505 — unique_violation (primary key on (project_id, user_id)).
    if (insertError.code === "23505") {
      return {
        status: "error",
        message: "Этот пользователь уже в проекте",
      };
    }
    return { status: "error", message: insertError.message };
  }

  revalidatePath(`/app/projects/${parsed.data.projectId}`);
  return {
    status: "success",
    message: `Пользователь ${parsed.data.email} добавлен`,
  };
}

// ============================================================
// changeRole — owner-only, demotes/promotes among editor / viewer
// ============================================================

const changeRoleSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["editor", "viewer"]),
});

export async function changeRole(formData: FormData): Promise<void> {
  const parsed = changeRoleSchema.safeParse({
    projectId: formData.get("projectId"),
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные");
  }

  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("project_members")
    .update({ role: parsed.data.role })
    .eq("project_id", parsed.data.projectId)
    .eq("user_id", parsed.data.userId);

  if (error) throw new Error(error.message);

  revalidatePath(`/app/projects/${parsed.data.projectId}`);
}

// ============================================================
// removeMember — owner removes someone else (not themselves)
// ============================================================

const removeMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function removeMember(formData: FormData): Promise<void> {
  const parsed = removeMemberSchema.safeParse({
    projectId: formData.get("projectId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) {
    throw new Error("Некорректные данные");
  }

  const { supabase, user } = await requireUser();

  if (parsed.data.userId === user.id) {
    throw new Error(
      'Чтобы покинуть проект, используйте кнопку "Покинуть проект".',
    );
  }

  // RLS enforces that only owners can remove other members.
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", parsed.data.projectId)
    .eq("user_id", parsed.data.userId);

  if (error) throw new Error(error.message);

  revalidatePath(`/app/projects/${parsed.data.projectId}`);
}

// ============================================================
// leaveProject — current user removes themselves from a project
// ============================================================
// If the leaver is the sole owner AND there are other members left,
// they must transfer ownership first. If they are the sole member
// overall, the after-delete trigger drops the project automatically.

const leaveSchema = z.object({
  projectId: z.string().uuid(),
});

export async function leaveProject(formData: FormData): Promise<void> {
  const parsed = leaveSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) {
    throw new Error("Некорректные данные");
  }

  const { supabase, user } = await requireUser();

  // Guard: if I'm the only owner and there are other members, refuse.
  const { data: myRow } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", parsed.data.projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (myRow?.role === "owner") {
    const { count: ownerCount } = await supabase
      .from("project_members")
      .select("*", { count: "exact", head: true })
      .eq("project_id", parsed.data.projectId)
      .eq("role", "owner");

    const { count: totalCount } = await supabase
      .from("project_members")
      .select("*", { count: "exact", head: true })
      .eq("project_id", parsed.data.projectId);

    if ((ownerCount ?? 0) <= 1 && (totalCount ?? 0) > 1) {
      throw new Error(
        "Передайте права владения другому участнику перед выходом из проекта.",
      );
    }
  }

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", parsed.data.projectId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  // Project may have been auto-deleted by trigger. Either way, send
  // the user back to their projects list.
  revalidatePath("/app/projects");
  redirect("/app/projects");
}

// ============================================================
// transferOwnership — atomic via SECURITY DEFINER RPC
// ============================================================

const transferSchema = z.object({
  projectId: z.string().uuid(),
  toUserId: z.string().uuid(),
});

export async function transferOwnership(formData: FormData): Promise<void> {
  const parsed = transferSchema.safeParse({
    projectId: formData.get("projectId"),
    toUserId: formData.get("toUserId"),
  });
  if (!parsed.success) {
    throw new Error("Некорректные данные");
  }

  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("transfer_project_ownership", {
    p_project_id: parsed.data.projectId,
    p_to_user_id: parsed.data.toUserId,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/app/projects/${parsed.data.projectId}`);
}
