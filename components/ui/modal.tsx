"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
};

type ConfirmRequest = {
  options: ConfirmOptions;
  resolve: (ok: boolean) => void;
};

/**
 * Promise-based confirm dialog hook. Drop-in replacement for window.confirm()
 * but with the new design tokens and async UX (no thread-blocking modal).
 *
 * Usage:
 *   const { confirm, dialog } = useConfirm();
 *   async function handleDelete() {
 *     if (await confirm({ title: 'Удалить?', variant: 'danger' })) {
 *       runDelete();
 *     }
 *   }
 *   return <>...{dialog}</>;
 */
export function useConfirm() {
  const [pending, setPending] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        setPending({ options, resolve });
      }),
    [],
  );

  const handleClose = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  const dialog = pending ? (
    <ConfirmModal
      title={pending.options.title}
      description={pending.options.description}
      confirmLabel={pending.options.confirmLabel ?? "Подтвердить"}
      cancelLabel={pending.options.cancelLabel ?? "Отмена"}
      variant={pending.options.variant ?? "default"}
      onConfirm={() => handleClose(true)}
      onCancel={() => handleClose(false)}
    />
  ) : null;

  return { confirm, dialog };
}

type ConfirmModalProps = {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  variant: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmModal({
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Lock body scroll while modal is open + close on Esc.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  // SSR-safe portal target.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-ink/40 backdrop-blur-[2px] animate-[fadeIn_120ms_ease-out]"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[420px] bg-white rounded-modal shadow-lg border border-line p-6 animate-[scaleIn_140ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="modal-title"
          className="text-[1.15rem] font-bold tracking-[-0.01em] text-ink mb-2"
        >
          {title}
        </h2>
        {description ? (
          <div className="text-[0.95rem] text-muted leading-snug mb-5">
            {description}
          </div>
        ) : (
          <div className="mb-5" />
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="md" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            size="md"
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
