"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicConfig } from "@/lib/public-config";
import type { AuthFormState } from "./state";

const signUpSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(8, "Пароль минимум 8 символов"),
  displayName: z
    .string()
    .min(1, "Имя обязательно")
    .max(64, "Слишком длинное имя"),
});

const signInSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
});

function buildEmailRedirectTo(): string | undefined {
  // Supabase needs an absolute URL to redirect to after the user clicks
  // the email-confirmation link. We read it from NEXT_PUBLIC_SITE_URL.
  // In local dev (no env set) this is undefined and Supabase falls back
  // to the project's default Site URL configured in the dashboard.
  if (!publicConfig.publicBaseUrl) return undefined;
  return `${publicConfig.publicBaseUrl}/auth/callback`;
}

function collectFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Decide where to send a freshly-authenticated user.
 *
 * Block 12 (11): a brand-new user (no projects yet) lands on /account
 * so they can confirm their display name first. Returning users with
 * projects skip /account and go straight to /app/projects.
 *
 * Reads project count through RLS — only counts projects where the user
 * is a member, which is exactly what we want.
 */
export async function landingPathAfterAuth(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("app_projects")
    .select("id", { count: "exact", head: true });
  return (count ?? 0) > 0 ? "/app/projects" : "/account";
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: null,
      fieldErrors: collectFieldErrors(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: buildEmailRedirectTo(),
    },
  });

  if (error) {
    return { status: "error", message: error.message, fieldErrors: {} };
  }

  // When Supabase's "Confirm email" is enabled (default), session is null
  // and the user must click the confirmation link first.
  if (!data.session) {
    return {
      status: "needs_confirmation",
      message: `Мы отправили письмо с подтверждением на ${parsed.data.email}. Перейдите по ссылке в письме, чтобы завершить регистрацию.`,
      fieldErrors: {},
    };
  }

  // Sign-up always lands on /account so the new user immediately sees
  // their profile (no projects yet by definition).
  redirect("/account");
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: null,
      fieldErrors: collectFieldErrors(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Don't leak whether the email exists — generic message for both cases.
    return {
      status: "error",
      message: "Неверный email или пароль",
      fieldErrors: {},
    };
  }

  redirect(await landingPathAfterAuth());
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Block 12 polish: Google OAuth now runs entirely client-side via
// supabase.auth.signInWithOAuth in `<GoogleSignInButton>` — no server
// round-trip before the browser hits accounts.google.com. This server
// action is kept for backwards compat and as a fallback for any callers
// that still want a server-driven OAuth start.
export async function signInWithGoogle() {
  const supabase = await createSupabaseServerClient();

  const redirectTo = publicConfig.publicBaseUrl
    ? `${publicConfig.publicBaseUrl}/auth/callback`
    : undefined;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error) {
    throw new Error(`Не удалось начать вход через Google: ${error.message}`);
  }

  if (data?.url) {
    redirect(data.url);
  }

  throw new Error("Supabase не вернул URL для Google OAuth");
}
