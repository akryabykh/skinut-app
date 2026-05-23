"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserCog } from "lucide-react";
import { signOut } from "@/app/auth/actions";

type UserMenuProps = {
  displayName: string;
  avatarUrl: string | null;
  email: string;
};

/**
 * Avatar + name + dropdown menu in the right of <AppHeader>.
 *
 * Click on the trigger toggles a small floating panel with:
 *   - «Настройки профиля» → /account
 *   - «Выйти» → server action signOut()
 *
 * The avatar is the user's Google `picture` if available (rendered as
 * plain <img> to skip next/image domain configuration overhead), else
 * a colored circle with the first letter of the display name as fallback.
 */
export function UserMenu({ displayName, avatarUrl, email }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on Escape + click outside.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function onClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) close();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, close]);

  const initial =
    displayName?.trim()?.charAt(0)?.toUpperCase() ||
    email?.trim()?.charAt(0)?.toUpperCase() ||
    "?";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 sm:gap-2 h-10 pr-1.5 pl-1.5 sm:pr-2 sm:pl-1 rounded-control hover:bg-[#F4F4F1] transition-colors"
      >
        <Avatar avatarUrl={avatarUrl} initial={initial} />
        <span className="hidden sm:inline text-[0.92rem] font-semibold text-ink max-w-[160px] truncate">
          {displayName}
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-40 w-[220px] rounded-card border border-line bg-white shadow-md p-1 animate-[scaleIn_120ms_ease-out] origin-top-right"
        >
          <div className="px-3 py-2 border-b border-line">
            <p className="text-[0.92rem] font-semibold text-ink truncate">
              {displayName}
            </p>
            <p className="text-[0.78rem] text-muted truncate">{email}</p>
          </div>
          <Link
            href="/account"
            role="menuitem"
            onClick={close}
            className="flex items-center gap-2 px-3 py-2 rounded-[6px] text-[0.92rem] text-ink hover:bg-[#F4F4F1] transition-colors"
          >
            <UserCog size={16} aria-hidden="true" className="text-muted" />
            <span>Настройки профиля</span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-[6px] text-[0.92rem] text-ink hover:bg-[#F4F4F1] transition-colors"
            >
              <LogOut size={16} aria-hidden="true" className="text-muted" />
              <span>Выйти</span>
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Avatar({
  avatarUrl,
  initial,
}: {
  avatarUrl: string | null;
  initial: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="h-8 w-8 rounded-full bg-accent-soft text-accent-dark font-semibold text-[0.88rem] inline-flex items-center justify-center"
    >
      {initial}
    </span>
  );
}
