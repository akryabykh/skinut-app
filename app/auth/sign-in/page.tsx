import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/account");
  }

  return (
    <main className="placeholder-page">
      <Brand />
      <section className="placeholder-panel">
        <p className="eyebrow">Вход</p>
        <h1>С возвращением</h1>
        <p>Войдите, чтобы продолжить вести свои проекты и историю трат.</p>
        <SignInForm />
      </section>
    </main>
  );
}
