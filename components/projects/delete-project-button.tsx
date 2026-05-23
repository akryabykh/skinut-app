"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/modal";
import { deleteProject } from "@/app/app/projects/actions";

type DeleteProjectButtonProps = {
  projectId: string;
  projectName: string;
};

/**
 * Compact «Удалить» icon-button that sits next to «Настройки проекта» on
 * the projects-list card. Block 12 polish: lets the owner delete a project
 * without going into settings first.
 *
 * Flow: click → useConfirm modal («Удалить проект "<имя>"?») → on confirm
 * the form is resubmitted via `form.requestSubmit()`, the server action
 * runs (which now also redirects to /app/projects, so the user lands on
 * an up-to-date list, no 404).
 *
 * Only rendered for owner-role users (RLS would also block the DELETE for
 * non-owners, but hiding the button avoids the dead-end click).
 */
export function DeleteProjectButton({
  projectId,
  projectName,
}: DeleteProjectButtonProps) {
  const { confirm, dialog } = useConfirm();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    if (form.dataset.confirmed === "true") {
      // Second pass — let the form action fire.
      form.dataset.confirmed = "";
      setBusy(true);
      return;
    }
    event.preventDefault();
    const ok = await confirm({
      title: `Удалить проект «${projectName}»?`,
      description:
        "Все участники, траты и история будут стёрты безвозвратно.",
      confirmLabel: "Удалить",
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
      <form
        action={deleteProject}
        onSubmit={handleSubmit}
        // Sit above the background-link of the card so clicks here land
        // on the button, not on the underlying "open project" link.
        className="pointer-events-auto"
      >
        <input type="hidden" name="id" value={projectId} />
        <button
          type="submit"
          disabled={busy}
          aria-label={`Удалить проект «${projectName}»`}
          className="inline-flex items-center justify-center h-8 w-8 rounded-control border border-line bg-white text-muted hover:border-danger hover:bg-[#FBEAE7] hover:text-danger transition-colors disabled:opacity-50"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </form>
      {dialog}
    </>
  );
}
