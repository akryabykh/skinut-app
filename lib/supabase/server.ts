import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicConfig } from "@/lib/public-config";
import type { Database } from "@/lib/database.types";

// Server-side Supabase client. Use in:
//   - Server Components
//   - Server Actions
//   - Route Handlers
//
// Reads the user session from request cookies. In Server Components,
// setAll() will throw (cookies are read-only there) — that's expected:
// session refresh is handled in middleware.ts on the same request.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicConfig.supabaseUrl,
    publicConfig.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — cookies are read-only.
            // The middleware will refresh the session on the next request.
          }
        },
      },
    },
  );
}
