import { forwardRef, type ComponentProps } from "react";

const base =
  "w-full h-11 sm:h-10 px-3 rounded-control border border-line bg-white text-ink " +
  "placeholder:text-[#A1A1AA] " +
  "transition-[border-color,box-shadow] duration-150 " +
  "focus:outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(244,98,58,0.18)] " +
  "disabled:bg-paper disabled:opacity-70";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  function Input({ className = "", type = "text", ...rest }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={`${base} ${className}`.trim()}
        {...rest}
      />
    );
  },
);
