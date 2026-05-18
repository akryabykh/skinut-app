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
//
// TODO(env): we'd prefer to throw when env vars are missing, but on Vercel
// preview deploys the NEXT_PUBLIC_* values are not getting inlined into the
// client bundle for reasons we haven't pinned down yet (build cache cleared,
// Sensitive flag off, names match — yet the bundle hash never changes and
// process.env is undefined in the browser). Until that's sorted, keep the
// hardcoded fallbacks — they point to the same Supabase project that anon
// key is scoped to anyway, and they're safe to expose publicly.

const FALLBACK_SUPABASE_URL = "https://eejbgcmdoxztcplwtvmy.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_R9rxuAYxvBd-jhhaf8jIFQ_sAfl7sdm";

export const publicConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY,
  publicBaseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
};
