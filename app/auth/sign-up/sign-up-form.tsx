"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUp } from "../actions";
import { emptyAuthFormState } from "../state";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUp, emptyAuthFormState);

  // When Supabase requires email confirmation, the server action returns
  // status "needs_confirmation" with a message — show it instead of the form.
  if (state.status === "needs_confirmation") {
    return (
      <div className="grid gap-4">
        <p
          role="status"
          className="rounded-control border border-[#F8D4C5] bg-accent-soft text-accent-dark text-[0.93rem] leading-snug px-3.5 py-3"
        >
          {state.message}
        </p>
        <p className="text-[0.92rem] text-muted text-center">
          Уже подтвердили?{" "}
          <Link
            href="/auth/sign-in"
            className="text-accent font-semibold hover:text-accent-dark transition-colors"
          >
            Войти
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <label className="grid gap-1.5">
        <span className="text-[0.82rem] font-medium text-muted">Имя</span>
        <Input
          name="displayName"
          type="text"
          required
          autoComplete="name"
          maxLength={64}
          aria-invalid={Boolean(state.fieldErrors.displayName)}
        />
        {state.fieldErrors.displayName && (
          <span className="text-[0.82rem] font-medium text-danger">
            {state.fieldErrors.displayName}
          </span>
        )}
      </label>

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
          autoComplete="new-password"
          minLength={8}
          aria-invalid={Boolean(state.fieldErrors.password)}
        />
        {state.fieldErrors.password && (
          <span className="text-[0.82rem] font-medium text-danger">
            {state.fieldErrors.password}
          </span>
        )}
        <span className="text-[0.78rem] text-muted">Минимум 8 символов</span>
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
        {pending ? "Создаём…" : "Зарегистрироваться"}
      </Button>

      <p className="text-[0.92rem] text-muted text-center mt-1">
        Уже есть аккаунт?{" "}
        <Link
          href="/auth/sign-in"
          className="text-accent font-semibold hover:text-accent-dark transition-colors"
        >
          Войти
        </Link>
      </p>
    </form>
  );
}
