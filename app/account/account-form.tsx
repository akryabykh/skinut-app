"use client";

import { type FormEvent, useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
      <form action={formAction} className="grid gap-4" noValidate>
        <label className="grid gap-1.5">
          <span className="text-[0.82rem] font-medium text-muted">
            Имя для отображения
          </span>
          <Input
            name="displayName"
            type="text"
            defaultValue={initialDisplayName}
            required
            maxLength={64}
            autoComplete="name"
          />
        </label>

        {state.status === "error" && state.message ? (
          <p
            role="alert"
            className="rounded-control border border-danger/20 bg-[#FBEAE7] text-danger text-[0.93rem] leading-snug px-3.5 py-2.5"
          >
            {state.message}
          </p>
        ) : null}
        {state.status === "success" && state.message ? (
          <p
            role="status"
            className="rounded-control border border-[#F8D4C5] bg-accent-soft text-accent-dark text-[0.93rem] leading-snug px-3.5 py-2.5"
          >
            {state.message}
          </p>
        ) : null}

        <div>
          <Button type="submit" variant="primary" size="md" disabled={pending}>
            {pending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </form>

      <Card
        variant="default"
        className="!p-5 mt-6 !border-danger/20 !bg-[#FBEAE7]/30"
      >
        <h2 className="text-[1rem] font-bold tracking-[-0.01em] text-danger mb-1">
          Внимание
        </h2>
        <p className="text-[0.9rem] text-muted leading-snug mb-4">
          Удаление аккаунта необратимо. Все ваши проекты — участники, расходы и
          история — будут стёрты вместе с аккаунтом.
        </p>
        <form action={deleteAccount} onSubmit={handleDeleteSubmit}>
          <Button type="submit" variant="danger" size="md" disabled={deleting}>
            {deleting ? "Удаляем…" : "Удалить аккаунт"}
          </Button>
        </form>
      </Card>
    </>
  );
}
