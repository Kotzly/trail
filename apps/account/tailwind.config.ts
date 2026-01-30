import type { Config } from "tailwindcss";
import preset from "@trail/ui/tailwind-preset";

const config: Config = {
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/content/src/**/*.{ts,tsx}",
    "../../packages/trpc/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        base: "rgb(var(--base) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-strong": "rgb(var(--surface-strong) / <alpha-value>)",
        stroke: "rgb(var(--stroke) / <alpha-value>)",
        "ink-subtle": "rgb(var(--ink-subtle) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-soft": "rgb(var(--accent-soft) / <alpha-value>)"
      },
      fontFamily: {
        display: ["var(--font-display)", "Fraunces", "serif"]
      },
      boxShadow: {
        card: "var(--trail-elev-2)"
      }
    }
  }
};

export default config;
