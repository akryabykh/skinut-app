import { forwardRef, type ComponentProps } from "react";

// Same visual contract as <Input> — h-11 sm:h-10 (44 mobile / 40 desktop),
// border-line on rest, ink + coral focus ring. We use the native <select>
// so platform menus (especially on iOS/Android) work out of the box —
// that matters for the bill-splitting use case where the user picks a
// currency on their phone at a café table.
const base =
  "w-full h-11 sm:h-10 pl-3 pr-9 rounded-control border border-line bg-white text-ink " +
  "appearance-none " +
  "transition-[border-color,box-shadow] duration-150 " +
  "focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(244,98,58,0.18)] " +
  "disabled:bg-paper disabled:opacity-70 " +
  // Custom chevron via background-image — works without extra wrapper element.
  "bg-no-repeat bg-[right_0.75rem_center] " +
  "bg-[length:18px_18px] " +
  "bg-[image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2218%22 height=%2218%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2371717A%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22></polyline></svg>')]";

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(
  function Select({ className = "", children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={`${base} ${className}`.trim()}
        {...rest}
      >
        {children}
      </select>
    );
  },
);
