"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/modal";
import { deleteAccount } from "./actions";

type Props = {
  email: string;
};

/**
 * "Внимание" — delete-account block, intentionally placed at the very
 * bottom of /account so it doesn't dominate everyday profile actions.
 *
 * Uses async useConfirm() instead of window.confirm() (Block 12 polish).
 */
export function DeleteAccountSection({ email }: Props) {
  const { confirm, dialog } = useConfirm();
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    if (form.dataset.confirmed === "true") {
      form.dataset.confirmed = "";
      setDeleting(true);
      return;
    }
    event.preventDefault();
    const ok = await confirm({
      title: "Удалить аккаунт?",
      description: (
        <>
          Аккаунт <strong>{email}</strong> и все ваши проекты — участники,
          траты и история — будут стёрты безвозвратно.
        </>
      ),
      confirmLabel: "Удалить аккаунт",
      cancelLabel: "Отмена",
      variant: "danger",
    });
    if (ok) {
      form.dataset.confirmed = "true";
      form.requestSubmit();
    }
  }

  return (
    <>
      <Card
        variant="default"
        className="!p-5 !border-danger/20 !bg-[#FBEAE7]/30"
      >
        <h2 className="text-[1rem] font-bold tracking-[-0.01em] text-danger mb-1">
          Внимание
        </h2>
        <p className="text-[0.9rem] text-muted leading-snug mb-4">
          Удаление аккаунта необратимо. Все ваши проекты — участники, траты
          и история — будут стёрты вместе с аккаунтом.
        </p>
        <form action={deleteAccount} onSubmit={handleSubmit}>
          <Button type="submit" variant="danger" size="md" disabled={deleting}>
            {deleting ? "Удаляем…" : "Удалить аккаунт"}
          </Button>
        </form>
      </Card>
      {dialog}
    </>
  );
}
