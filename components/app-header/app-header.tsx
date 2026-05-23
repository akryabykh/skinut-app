import Link from "next/link";
import { Brand } from "@/components/brand";
import { UserMenu } from "./user-menu";

type AppHeaderProps = {
  /** Display name for the user menu. Falls back to email-prefix when null. */
  displayName: string;
  /** Avatar URL (Google `picture`), or null for initials fallback. */
  avatarUrl: string | null;
  /** Email shown inside the dropdown menu. */
  email: string;
  /** Optional — highlights the matching nav-link. */
  active?: "projects" | "account" | null;
};

/**
 * Single shared header for all authenticated pages.
 *
 * Layout:
 *   left:   <Brand href="/" />
 *   right:  «Мои проекты» link (highlighted on /app/projects), then UserMenu
 *
 * The /account link lives inside <UserMenu> rather than the navbar — the
 * mockup shows the avatar dropdown as the primary access point for the
 * profile.
 */
export function AppHeader({
  displayName,
  avatarUrl,
  email,
  active = null,
}: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 mb-8">
      <Brand href="/" />
      <nav className="flex items-center gap-1 sm:gap-3">
        <Link
          href="/app/projects"
          className={[
            "inline-flex items-center h-10 px-2 sm:px-3 rounded-control text-[0.92rem] font-semibold transition-colors",
            active === "projects"
              ? "text-accent"
              : "text-ink hover:text-accent",
          ].join(" ")}
        >
          Мои проекты
        </Link>
        <UserMenu
          displayName={displayName}
          avatarUrl={avatarUrl}
          email={email}
        />
      </nav>
    </header>
  );
}
