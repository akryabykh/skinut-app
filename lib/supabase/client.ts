import { createBrowserClient } from "@supabase/ssr";
import { publicConfig } from "@/lib/public-config";
import type { Database } from "@/lib/database.types";

// Browser-side Supabase client. Use only inside "use client" components,
// e.g. for realtime subscriptions or anonymous (public) reads from the browser.
// Auth flows (signup/signin) live in server actions — see app/auth/actions.ts.
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    publicConfig.supabaseUrl,
    publicConfig.supabaseAnonKey,
  );
}
