// Shared form state for /account actions.
//
// Kept separate from actions.ts because a "use server" file can only
// export async functions (see app/auth/state.ts for the same pattern).

export type AccountFormState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const emptyAccountFormState: AccountFormState = {
  status: "idle",
  message: null,
};
