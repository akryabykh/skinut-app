"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Multi-colour official Google "G" logomark in pure SVG, no deps.
function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

type GoogleSignInButtonProps = {
  label?: string;
};

/**
 * Client-side Google OAuth trigger.
 *
 * Calls `supabase.auth.signInWithOAuth` directly from the browser — Supabase
 * builds the `accounts.google.com/...` URL and we immediately redirect
 * via `window.location.replace`. This is faster than the previous server-
 * action approach (which had a server round-trip cold start of 1-2s before
 * even hitting Google).
 *
 * No `prompt: select_account` — Google will skip the chooser if the user
 * already has a single signed-in Google account, getting them through in
 * one tap. Multi-account users still see the chooser automatically.
 *
 * No `access_type: offline` — we don't use Google's refresh token; Supabase
 * manages its own session lifecycle.
 */
export function GoogleSignInButton({
  label = "Войти через Google",
}: GoogleSignInButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) throw oauthError;
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      throw new Error("Supabase не вернул URL");
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Не удалось начать вход через Google";
      setError(message);
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={[
          "w-full inline-flex items-center justify-center gap-2.5",
          "h-11 sm:h-12 px-4 rounded-control",
          "bg-white text-ink font-semibold text-[0.95rem] tracking-[-0.005em]",
          "border border-line hover:border-[#D4D4D8] hover:bg-[#F4F4F1]",
          "transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
          "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        ].join(" ")}
      >
        {busy ? (
          <Loader2 size={18} aria-hidden="true" className="animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        <span>{busy ? "Перенаправляем…" : label}</span>
      </button>
      {error ? (
        <p
          role="alert"
          className="rounded-control border border-danger/20 bg-[#FBEAE7] text-danger text-[0.85rem] leading-snug px-3 py-2"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
