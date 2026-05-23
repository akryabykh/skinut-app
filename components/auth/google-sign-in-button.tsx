import { signInWithGoogle } from "@/app/auth/actions";

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
  /** "Войти через Google" (default) or "Регистрация через Google" */
  label?: string;
};

/**
 * Server-action button that kicks off Supabase Google OAuth flow.
 *
 * Implemented as `<form action={signInWithGoogle}>` (rather than an
 * onClick handler with useTransition) so it works even when JS is slow
 * to hydrate — clicking submits the form, which fires the server action,
 * which redirects to Google. No client state involved.
 *
 * Requires Google provider enabled in Supabase Dashboard with an OAuth
 * Client ID/Secret from Google Cloud Console.
 */
export function GoogleSignInButton({
  label = "Войти через Google",
}: GoogleSignInButtonProps) {
  return (
    <form action={signInWithGoogle}>
      <button
        type="submit"
        className={[
          "w-full inline-flex items-center justify-center gap-2.5",
          "h-11 sm:h-12 px-4 rounded-control",
          "bg-white text-ink font-semibold text-[0.95rem] tracking-[-0.005em]",
          "border border-line hover:border-[#D4D4D8] hover:bg-[#F4F4F1]",
          "transition-colors",
          "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        ].join(" ")}
      >
        <GoogleIcon />
        <span>{label}</span>
      </button>
    </form>
  );
}
