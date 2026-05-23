import type { ComponentProps, ReactNode } from "react";

type Variant = "default" | "soft" | "muted";

const variants: Record<Variant, string> = {
  default: "bg-white border border-line shadow-xs",
  soft: "bg-[#FCE9E1] border border-[#F8D4C5]",
  muted: "bg-[#F4F4F1] border border-line",
};

type CardProps = ComponentProps<"div"> & {
  variant?: Variant;
  children?: ReactNode;
};

export function Card({
  variant = "default",
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-card p-5 ${variants[variant]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
