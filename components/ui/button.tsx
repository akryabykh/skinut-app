import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm" | "cta";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold tracking-[-0.005em] " +
  "transition-colors duration-150 " +
  "disabled:opacity-55 disabled:cursor-not-allowed " +
  "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Responsive heights: mobile 44px (h-11) for tap target, desktop scales down per size.
const sizes: Record<Size, string> = {
  md: "h-11 sm:h-10 px-4 text-[0.95rem]",
  sm: "h-11 sm:h-9 px-3 text-[0.88rem]",
  cta: "h-11 sm:h-12 px-5 text-[0.98rem]",
};

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-dark active:bg-accent-dark",
  secondary:
    "bg-white text-ink border border-line hover:border-[#D4D4D8] hover:bg-[#F4F4F1]",
  ghost: "bg-transparent text-ink hover:bg-[#F4F4F1]",
  danger:
    "bg-white text-danger border border-line hover:border-danger hover:bg-[#FBEAE7]",
};

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Link>
  );
}
