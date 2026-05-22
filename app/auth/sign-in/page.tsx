import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { Card } from "@/components/ui/card";
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
    <main className="min-h-svh flex flex-col items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-[420px] mb-8 flex justify-center">
        <Brand href="/" />
      </div>
      <Card className="w-full max-w-[420px] !p-8 shadow-sm">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted mb-2">
          Вход
        </p>
        <h1 className="text-[1.85rem] font-bold tracking-[-0.02em] text-ink leading-tight">
          С возвращением
        </h1>
        <p className="text-[0.95rem] text-muted leading-snug mt-2 mb-6">
          Войдите, чтобы продолжить вести свои проекты и историю трат.
        </p>
        <SignInForm />
      </Card>
    </main>
  );
}
