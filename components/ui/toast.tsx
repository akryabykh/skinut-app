"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

type ToastVariant = "success" | "error";

type ActiveToast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

const DURATION_MS = 2500;

/**
 * Lightweight component-local toast. Use:
 *   const { showToast, toast } = useToast();
 *   showToast('Сохранено');
 *   return <>...{toast}</>;
 *
 * No provider — each consumer owns its own toast queue. For an app this size
 * that's plenty; a single toast at a time is the expected UX anyway.
 */
export function useToast() {
  const [active, setActive] = useState<ActiveToast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const dismiss = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setActive(null);
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      counter.current += 1;
      const id = counter.current;
      if (timer.current) clearTimeout(timer.current);
      setActive({ id, message, variant });
      timer.current = setTimeout(() => {
        // Only dismiss if this is still the active toast (avoid race).
        setActive((current) => (current?.id === id ? null : current));
        timer.current = null;
      }, DURATION_MS);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const toast = active ? (
    <ToastView toast={active} onDismiss={dismiss} />
  ) : null;

  return { showToast, toast };
}

function ToastView({
  toast,
  onDismiss,
}: {
  toast: ActiveToast;
  onDismiss: () => void;
}) {
  if (typeof document === "undefined") return null;

  const palette =
    toast.variant === "success"
      ? "bg-ink text-white border-ink"
      : "bg-[#FBEAE7] text-danger border-danger/20";

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+20px)] left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-[toastIn_180ms_ease-out]"
    >
      <button
        type="button"
        onClick={onDismiss}
        className={[
          "pointer-events-auto inline-flex items-center gap-2 px-4 h-11 rounded-card border shadow-md font-semibold text-[0.92rem] tracking-[-0.005em]",
          palette,
        ].join(" ")}
      >
        {toast.variant === "success" ? (
          <Check size={16} aria-hidden="true" />
        ) : null}
        <span>{toast.message}</span>
      </button>
    </div>,
    document.body,
  );
}
