"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, emptyAuthFormState } from "../actions";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUp, emptyAuthFormState);

  // When Supabase requires email confirmation, the server action returns
  // status "needs_confirmation" with a message — show it instead of the form.
  if (state.status === "needs_confirmation") {
    return (
      <div className="auth-form">
        <p className="auth-banner auth-banner-success">{state.message}</p>
        <p className="auth-foot">
          Уже подтвердили? <Link href="/auth/sign-in">Войти</Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="auth-form" noValidate>
      <label className="field">
        <span className="field-label">Имя</span>
        <input
          className="text-input"
          name="displayName"
          type="text"
          required
          autoComplete="name"
          maxLength={64}
          aria-invalid={Boolean(state.fieldErrors.displayName)}
        />
        {state.fieldErrors.displayName && (
          <span className="auth-error">{state.fieldErrors.displayName}</span>
        )}
      </label>

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
          autoComplete="new-password"
          minLength={8}
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
        {pending ? "Создаём…" : "Зарегистрироваться"}
      </button>

      <p className="auth-foot">
        Уже есть аккаунт? <Link href="/auth/sign-in">Войти</Link>
      </p>
    </form>
  );
}
