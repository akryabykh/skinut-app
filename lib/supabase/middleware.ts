import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicConfig } from "@/lib/public-config";
import type { Database } from "@/lib/database.types";

// Refreshes the Supabase session on every request and writes updated
// auth cookies onto the outgoing response. Without this, expired access
// tokens would never be replaced and users would be silently signed out.
//
// Called from the root middleware.ts.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicConfig.supabaseUrl,
    publicConfig.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not remove this call. getUser() triggers a session refresh
  // when the access token is close to expiring. Removing it breaks auth in
  // a subtle way (works on fresh sessions, fails an hour later).
  await supabase.auth.getUser();

  return supabaseResponse;
}
