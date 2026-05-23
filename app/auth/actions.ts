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

  redirect("/account");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Block 11: One-click Google OAuth.
//
// Calls Supabase's signInWithOAuth on the server to get back an
// `accounts.google.com/...` URL, then redirects the user there. Google
// authenticates, sends them back to our /auth/callback with ?code=...,
// and the existing route handler exchanges that for a real session.
//
// Requires Google provider to be enabled in Supabase Dashboard with a
// valid OAuth Client ID/Secret from Google Cloud Console.
export async function signInWithGoogle() {
  const supabase = await createSupabaseServerClient();

  const redirectTo = publicConfig.publicBaseUrl
    ? `${publicConfig.publicBaseUrl}/auth/callback`
    : undefined;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      // Always ask for an email + profile (default scope) — no extra needed.
      queryParams: {
        access_type: "offline", // get refresh_token from Google too
        prompt: "select_account", // let the user pick which Google account
      },
    },
  });

  if (error) {
    throw new Error(`Не удалось начать вход через Google: ${error.message}`);
  }

  if (data?.url) {
    redirect(data.url);
  }

  throw new Error("Supabase не вернул URL для Google OAuth");
}
