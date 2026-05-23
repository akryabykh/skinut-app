import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { landingPathAfterAuth } from "../actions";

// Handler for Supabase email-confirmation links and OAuth callbacks.
// Supabase appends ?code=... to the redirect URL; we exchange it for a
// session and forward the user to /app/projects (returning users with
// projects) or /account (brand-new users) — see landingPathAfterAuth().
//
// An explicit ?next=... wins over the smart landing.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=exchange_failed`);
  }

  // Only allow internal redirects to avoid open-redirect attacks.
  const target =
    next && next.startsWith("/") ? next : await landingPathAfterAuth();
  return NextResponse.redirect(`${origin}${target}`);
}
