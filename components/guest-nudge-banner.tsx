"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  dismissGuestNudge,
  isGuestNudgeDismissed,
} from "@/lib/guest-storage";

/**
 * Soft nudge rendered above the calculator when in guest mode.
 * Reminds the user that registering will sync the расчёт across devices.
 * Dismissible (closing it sets a localStorage flag so the banner doesn't
 * come back in this browser).
 */
export function GuestNudgeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isGuestNudgeDismissed()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function handleDismiss() {
    dismissGuestNudge();
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Гостевой режим"
      className="mb-3 rounded-card border border-line bg-white px-4 py-3 flex items-start gap-3"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-dark text-[0.78rem] font-bold"
      >
        ✦
      </span>
      <div className="min-w-0 flex-1 text-[0.9rem] leading-snug">
        <p className="text-ink">
          <span className="font-semibold">Локальный режим.</span>{" "}
          <span className="text-muted">
            Расчёт хранится только в этом браузере.{" "}
          </span>
          <Link
            href="/auth/sign-up"
            className="font-semibold text-accent hover:text-accent-dark underline-offset-2 hover:underline"
          >
            Зарегистрируйтесь
          </Link>
          <span className="text-muted">
            , чтобы синхронизировать с телефоном и сохранить надёжно.
          </span>
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Скрыть"
        className="shrink-0 -mt-1 -mr-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-[#F4F4F1] hover:text-ink transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
