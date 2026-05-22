import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A0A",
        paper: "#FAFAF7",
        line: "#E4E4E7",
        muted: "#71717A",
        accent: {
          DEFAULT: "#F4623A",
          dark: "#D94E27",
          soft: "#FCE9E1",
        },
        danger: "#B42318",
        // Legacy alias kept so utility classes referencing `brand` still build
        // (some product pages may use bg-brand etc.). Maps to new accent.
        brand: "#F4623A",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Inter Tight",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      fontFeatureSettings: {
        // No standard Tailwind utility for this — apply via CSS or arbitrary
      },
      borderRadius: {
        control: "8px",
        card: "12px",
        modal: "20px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(10, 10, 10, 0.04)",
        sm: "0 2px 6px rgba(10, 10, 10, 0.06)",
        md: "0 8px 24px rgba(10, 10, 10, 0.08)",
        lg: "0 24px 48px rgba(10, 10, 10, 0.12)",
      },
      letterSpacing: {
        tightish: "-0.01em",
        tighter2: "-0.02em",
      },
    },
  },
  plugins: [],
};

export default config;
