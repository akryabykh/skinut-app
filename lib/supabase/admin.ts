import { createClient } from "@supabase/supabase-js";
import { publicConfig } from "@/lib/public-config";
import type { Database } from "@/lib/database.types";

// Service-role Supabase client. SERVER-ONLY.
//
// Service role bypasses RLS, so this file must never be imported from a
// client component or anywhere that ends up in the browser bundle — that
// would leak the secret. Callers should be server actions or route handlers
// guarded by a getUser() check before invoking admin operations.
//
// Current usage: supabase.auth.admin.deleteUser(...) for self-service
// account deletion in /account.

function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Required for admin operations.",
    );
  }
  return key;
}

export function createSupabaseAdminClient() {
  return createClient<Database>(
    publicConfig.supabaseUrl,
    requireServiceRoleKey(),
    {
      auth: {
        // The admin client should never persist or refresh a session —
        // it's used per-request on the server with the service role key.
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
