// Shared form state for member actions in /app/projects/[id].
//
// Lives outside members-actions.ts (which is "use server") because that
// module can only export async functions.

export type MembersFormState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const emptyMembersFormState: MembersFormState = {
  status: "idle",
  message: null,
};

export type MemberRole = "owner" | "editor" | "viewer";

export type MemberInfo = {
  user_id: string;
  role: MemberRole;
  email: string | null;
  display_name: string | null;
  joined_at: string;
};

export const ROLE_LABEL_RU: Record<MemberRole, string> = {
  owner: "Владелец",
  editor: "Редактор",
  viewer: "Только просмотр",
};
