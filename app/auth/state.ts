// Shared types and constants for the auth flow.
//
// Lives outside actions.ts on purpose: a module marked "use server" can
// only export async functions. Putting types or plain objects there
// fails the production build with:
//   "A 'use server' file can only export async functions, found object."

export type AuthFormState = {
  status: "idle" | "error" | "needs_confirmation";
  message: string | null;
  fieldErrors: Record<string, string>;
};

export const emptyAuthFormState: AuthFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};
