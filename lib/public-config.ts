// Public runtime configuration sourced from environment variables.
//
// NEXT_PUBLIC_* values are inlined into the client bundle at build time,
// so anything sensitive must NOT go here. Anon keys are safe by design —
// they're scoped by Supabase RLS.
//
// Setup:
//   - Local dev:  copy .env.example to .env.local and fill in real values
//   - Vercel:     set the same variables in Project → Settings → Environment Variables
//
// Where to find them in Supabase:
//   Project → Settings → API
//     URL                       → NEXT_PUBLIC_SUPABASE_URL
//     Project API keys → anon   → NEXT_PUBLIC_SUPABASE_ANON_KEY

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local (local dev) or in your hosting provider's ` +
        `dashboard. See lib/public-config.ts for details.`,
    );
  }
  return value;
}

export const publicConfig = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  // Optional. When set, used as the absolute origin for emailRedirectTo
  // in Supabase auth flows. If empty, Supabase falls back to the project's
  // Site URL configured in the dashboard.
  publicBaseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
};
