"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "../actions";
import { emptyAuthFormState } from "../state";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, emptyAuthFormState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <label className="grid gap-1.5">
        <span className="text-[0.82rem] font-medium text-muted">Email</span>
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-invalid={Boolean(state.fieldErrors.email)}
        />
        {state.fieldErrors.email && (
          <span className="text-[0.82rem] font-medium text-danger">
            {state.fieldErrors.email}
          </span>
        )}
      </label>

      <label className="grid gap-1.5">
        <span className="text-[0.82rem] font-medium text-muted">Пароль</span>
        <Input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors.password)}
        />
        {state.fieldErrors.password && (
          <span className="text-[0.82rem] font-medium text-danger">
            {state.fieldErrors.password}
          </span>
        )}
      </label>

      {state.status === "error" && state.message && (
        <p
          role="alert"
          className="rounded-control border border-danger/20 bg-[#FBEAE7] text-danger text-[0.93rem] leading-snug px-3.5 py-2.5"
        >
          {state.message}
        </p>
      )}

      <Button type="submit" variant="primary" size="cta" disabled={pending}>
        {pending ? "Входим…" : "Войти"}
      </Button>

      <p className="text-[0.92rem] text-muted text-center mt-1">
        Нет аккаунта?{" "}
        <Link
          href="/auth/sign-up"
          className="text-accent font-semibold hover:text-accent-dark transition-colors"
        >
          Зарегистрироваться
        </Link>
      </p>
    </form>
  );
}
