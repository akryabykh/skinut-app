import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Handler for Supabase email-confirmation links (and OAuth, if added later).
// Supabase appends ?code=... to the redirect URL; we exchange it for a session
// and forward the user to /account (or a custom ?next= path).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/account";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=exchange_failed`);
  }

  // Only allow internal redirects to avoid open-redirect attacks.
  const safeNext = next.startsWith("/") ? next : "/account";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
