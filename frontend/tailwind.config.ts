import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"] ,
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-muted": "rgb(var(--ink-muted) / <alpha-value>)",
        "ink-subtle": "rgb(var(--ink-subtle) / <alpha-value>)",
        base: "rgb(var(--base) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-strong": "rgb(var(--surface-strong) / <alpha-value>)",
        stroke: "rgb(var(--stroke) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-soft": "rgb(var(--accent-soft) / <alpha-value>)",
        sand: "rgb(var(--surface) / <alpha-value>)",
        moss: "rgb(var(--accent) / <alpha-value>)",
        coral: "rgb(var(--ink-subtle) / <alpha-value>)",
        gold: "rgb(var(--accent-soft) / <alpha-value>)",
        ocean: "rgb(var(--accent) / <alpha-value>)",
        sky: "rgb(var(--accent-soft) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Work Sans", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 24px 60px rgb(var(--ink) / 0.14)",
        card: "0 20px 50px rgb(var(--ink) / 0.12)",
      },
      borderRadius: {
        xl: "1.25rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
