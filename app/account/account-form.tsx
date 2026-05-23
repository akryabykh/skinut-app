"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateDisplayName } from "./actions";
import { emptyAccountFormState } from "./state";

type AccountFormProps = {
  initialDisplayName: string;
  /** Kept for legacy callers; currently unused by the form itself. */
  email?: string;
};

/**
 * Display-name edit form only. The delete-account section was extracted
 * into `<DeleteAccountSection>` in Block 12 so it can sit at the very
 * bottom of /account, visually separated from the everyday profile form.
 */
export function AccountForm({ initialDisplayName }: AccountFormProps) {
  const [state, formAction, pending] = useActionState(
    updateDisplayName,
    emptyAccountFormState,
  );

  return (
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
  );
}
