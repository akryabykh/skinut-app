"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "../actions";
import { emptyAuthFormState } from "../state";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, emptyAuthFormState);

  return (
    <form action={formAction} className="auth-form" noValidate>
      <label className="field">
        <span className="field-label">Email</span>
        <input
          className="text-input"
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-invalid={Boolean(state.fieldErrors.email)}
        />
        {state.fieldErrors.email && (
          <span className="auth-error">{state.fieldErrors.email}</span>
        )}
      </label>

      <label className="field">
        <span className="field-label">Пароль</span>
        <input
          className="text-input"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors.password)}
        />
        {state.fieldErrors.password && (
          <span className="auth-error">{state.fieldErrors.password}</span>
        )}
      </label>

      {state.status === "error" && state.message && (
        <p className="auth-banner auth-banner-error">{state.message}</p>
      )}

      <button
        className="primary-button hero-button"
        type="submit"
        disabled={pending}
      >
        {pending ? "Входим…" : "Войти"}
      </button>

      <p className="auth-foot">
        Нет аккаунта? <Link href="/auth/sign-up">Зарегистрироваться</Link>
      </p>
    </form>
  );
}
