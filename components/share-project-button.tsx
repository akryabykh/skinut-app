"use client";

import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { ensureShareToken } from "@/app/app/projects/share-actions";

type ShareProjectButtonProps = {
  projectId: string;
  /** Existing share token if owner/editor already minted one. Optimisation
   *  only — we still call ensureShareToken on click to guard against UI
   *  staleness; if a token already exists the server returns it instantly. */
  shareToken: string | null;
  onCopied?: () => void;
  onCopyFailed?: (url: string) => void;
  onError?: (message: string) => void;
};

/**
 * "Поделиться" — one-click share for the calculator header.
 *
 * Flow: click → server action `ensureShareToken(projectId)` (returns
 * either the existing token or mints a new one) → build /share/<token>
 * URL → copy to clipboard via `navigator.clipboard.writeText()` → fire
 * `onCopied()` so the parent can surface a toast.
 *
 * No drawer/modal — the contract is "click and the link is in your buffer,
 * paste it wherever you want". Matches the way Twitter / Telegram do
 * one-click share-URL copying.
 */
export function ShareProjectButton({
  projectId,
  shareToken,
  onCopied,
  onCopyFailed,
  onError,
}: ShareProjectButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const token = shareToken ?? (await ensureShareToken(projectId));
      const url = `${window.location.origin}/share/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        onCopied?.();
      } catch {
        onCopyFailed?.(url);
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Не удалось создать ссылку";
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label="Поделиться проектом"
      className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-2 sm:px-3 rounded-control border border-line bg-white text-ink hover:border-[#D4D4D8] hover:bg-[#F4F4F1] transition-colors disabled:opacity-60"
    >
      {busy ? (
        <Loader2 size={16} aria-hidden="true" className="animate-spin" />
      ) : (
        <Share2 size={16} aria-hidden="true" />
      )}
      <span className="hidden sm:inline text-[0.88rem] font-semibold">
        Поделиться
      </span>
    </button>
  );
}
