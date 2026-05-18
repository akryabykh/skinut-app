import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage() {
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
        <p className="eyebrow">Регистрация</p>
        <h1>Создайте аккаунт</h1>
        <p>Аккаунт нужен, чтобы сохранять проекты и историю трат на ваших устройствах.</p>
        <SignUpForm />
      </section>
    </main>
  );
}
