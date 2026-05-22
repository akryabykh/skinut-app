import Link from "next/link";

type BrandProps = {
  href?: string;
  className?: string;
};

/**
 * Word-mark «Скинуться.» — Inter Tight 700 + coral dot.
 * The original red square logo (public/logo-hero.svg) is kept only as the PWA app icon.
 */
export function Brand({ href = "/", className = "" }: BrandProps) {
  return (
    <Link
      className={`brand-link ${className}`.trim()}
      href={href}
      aria-label="Скинуться"
    >
      <span>Скинуться</span>
      <span className="brand-dot" aria-hidden="true">
        .
      </span>
    </Link>
  );
}
