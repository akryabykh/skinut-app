"use client";

import Link from "next/link";
import { Share2 } from "lucide-react";

type ShareProjectButtonProps = {
  projectId: string;
  shareToken: string | null;
  onCopied?: () => void;
  onCopyFailed?: (url: string) => void;
};

/**
 * Compact "Поделиться" trigger that lives in the calculator header
 * (Block 12 (7)). Two states:
 *
 *   - `shareToken == null` → renders as a <Link> to the project's
 *     settings page where the user can mint a token. Visually identical
 *     to the button so it doesn't pop out of the header layout.
 *   - `shareToken` set → renders a <button> that copies the public
 *     /share/<token> URL via the Clipboard API and fires `onCopied()`
 *     (the calculator wires it to a Toast). Fallback when clipboard is
 *     denied: `onCopyFailed(url)` so the calculator can surface a manual
 *     prompt with the link.
 */
export function ShareProjectButton({
  projectId,
  shareToken,
  onCopied,
  onCopyFailed,
}: ShareProjectButtonProps) {
  const baseClass =
    "inline-flex items-center justify-center h-10 sm:h-9 px-2 sm:px-3 rounded-control border border-line bg-white text-ink hover:border-[#D4D4D8] hover:bg-[#F4F4F1] transition-colors gap-1.5";

  if (!shareToken) {
    return (
      <Link
        href={`/app/projects/${projectId}`}
        aria-label="Поделиться проектом — создать публичную ссылку"
        className={baseClass}
      >
        <Share2 size={16} aria-hidden="true" />
        <span className="hidden sm:inline text-[0.88rem] font-semibold">
          Поделиться
        </span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}/share/${shareToken}`;
        try {
          await navigator.clipboard.writeText(url);
          onCopied?.();
        } catch {
          onCopyFailed?.(url);
        }
      }}
      aria-label="Скопировать ссылку для участников"
      className={baseClass}
    >
      <Share2 size={16} aria-hidden="true" />
      <span className="hidden sm:inline text-[0.88rem] font-semibold">
        Поделиться
      </span>
    </button>
  );
}
