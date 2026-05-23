import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Handler for Supabase email-confirmation links and OAuth callbacks.
// Supabase appends ?code=... to the redirect URL; we exchange it for a
// session and forward the user on.
//
// Defaults to /app/projects (the empty-state already handles brand-new
// users with no projects — they see «У вас пока нет проектов» + the
// "Новый проект" CTA, which is a better landing for OAuth signups than
// pushing them to /account just to look at their email).
//
// An explicit ?next=... wins over the default.
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
  const target = next && next.startsWith("/") ? next : "/app/projects";
  return NextResponse.redirect(`${origin}${target}`);
}
