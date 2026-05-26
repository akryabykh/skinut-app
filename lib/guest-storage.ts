/**
 * Shared helpers for the guest-mode (unauthenticated) calculator state.
 *
 * Guest state lives in localStorage under a single key. The calculator
 * reads/writes it directly when no project id is present in the URL;
 * the projects page shows an import banner if the user signs in while
 * a guest state still sits in storage.
 *
 * STORAGE_KEY is the historical key used by expense-calculator.tsx
 * since Block 3 — do NOT rename without a migration shim.
 */
export const GUEST_STORAGE_KEY = "split-app-state-v1";

/** Key for the dismissed-state of the nudge banner shown inside the guest
 *  calculator. Once a user clicks the X we never show it again in this
 *  browser, until they manually clear site data. */
export const GUEST_NUDGE_DISMISSED_KEY = "split-guest-nudge-dismissed-v1";

/** Loose shape we accept from localStorage. The calculator normalises
 *  this with `normalizeState` before using it, so we keep this permissive. */
export type GuestStateShape = {
  projectName?: string;
  expenseSort?: string;
  people?: Array<{ id: string; name: string }>;
  expenses?: Array<unknown>;
};

export function readGuestState(): GuestStateShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestStateShape;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearGuestState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GUEST_STORAGE_KEY);
  } catch {
    // localStorage may be disabled (private mode); ignore.
  }
}

export function hasGuestData(): boolean {
  const state = readGuestState();
  if (!state) return false;
  const hasPeople = Array.isArray(state.people) && state.people.length > 0;
  const hasExpenses = Array.isArray(state.expenses) && state.expenses.length > 0;
  return hasPeople || hasExpenses;
}

export function countGuestData(): { people: number; expenses: number } {
  const state = readGuestState();
  return {
    people: state?.people?.length ?? 0,
    expenses: state?.expenses?.length ?? 0,
  };
}

export function isGuestNudgeDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(GUEST_NUDGE_DISMISSED_KEY) === "1";
  } catch {
    return true;
  }
}

export function dismissGuestNudge(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUEST_NUDGE_DISMISSED_KEY, "1");
  } catch {
    // ignore
  }
}
