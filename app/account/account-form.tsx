"use client";

import { type FormEvent, useState } from "react";
import { useActionState } from "react";
import { deleteAccount, updateDisplayName } from "./actions";
import { emptyAccountFormState } from "./state";

type AccountFormProps = {
  initialDisplayName: string;
  email: string;
};

export function AccountForm({ initialDisplayName, email }: AccountFormProps) {
  const [state, formAction, pending] = useActionState(
    updateDisplayName,
    emptyAccountFormState,
  );
  const [deleting, setDeleting] = useState(false);

  function handleDeleteSubmit(event: FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `Удалить аккаунт ${email}?\n\n` +
        "Все ваши проекты будут безвозвратно удалены. " +
        "Это действие нельзя отменить.",
    );
    if (!confirmed) {
      event.preventDefault();
      return;
    }
    setDeleting(true);
  }

  return (
    <>
      <form action={formAction} className="auth-form" noValidate>
        <label className="field">
          <span className="field-label">Имя</span>
          <input
            className="text-input"
            name="displayName"
            type="text"
            defaultValue={initialDisplayName}
            required
            maxLength={64}
            autoComplete="name"
          />
        </label>

        {state.status === "error" && state.message ? (
          <p className="auth-banner auth-banner-error">{state.message}</p>
        ) : null}
        {state.status === "success" && state.message ? (
          <p className="auth-banner auth-banner-success">{state.message}</p>
        ) : null}

        <button
          type="submit"
          className="primary-button hero-button"
          disabled={pending}
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
      </form>

      <hr className="account-divider" />

      <section className="danger-zone">
        <h2>Опасная зона</h2>
        <p>
          Удаление аккаунта необратимо. Все ваши проекты — участники, расходы и
          история — будут стёрты вместе с аккаунтом.
        </p>
        <form action={deleteAccount} onSubmit={handleDeleteSubmit}>
          <button
            type="submit"
            className="ghost-button danger hero-button"
            disabled={deleting}
          >
            {deleting ? "Удаляем…" : "Удалить аккаунт"}
          </button>
        </form>
      </section>
    </>
  );
}
