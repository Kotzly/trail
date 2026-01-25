import type { Config } from "tailwindcss";

const preset: Config = {
  darkMode: ["class", "[data-theme=\"dark\"]"],
  content: [],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--trail-bg) / <alpha-value>)",
        surface: "rgb(var(--trail-surface) / <alpha-value>)",
        "surface-high": "rgb(var(--trail-surface-high) / <alpha-value>)",
        "surface-low": "rgb(var(--trail-surface-low) / <alpha-value>)",
        border: "rgb(var(--trail-border) / <alpha-value>)",
        ink: "rgb(var(--trail-ink) / <alpha-value>)",
        "ink-muted": "rgb(var(--trail-ink-muted) / <alpha-value>)",
        accent: "rgb(var(--trail-accent) / <alpha-value>)",
        "accent-contrast": "rgb(var(--trail-accent-contrast) / <alpha-value>)",
        highlight: "rgb(var(--trail-highlight) / <alpha-value>)",
        glass: "rgb(var(--trail-glass) / <alpha-value>)",
        "glass-strong": "rgb(var(--trail-glass-strong) / <alpha-value>)"
      },
      boxShadow: {
        "elev-1": "var(--trail-elev-1)",
        "elev-2": "var(--trail-elev-2)",
        "elev-3": "var(--trail-elev-3)"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "SF Pro Display", "SF Pro Text", "Segoe UI", "sans-serif"],
        serif: ["var(--font-serif)", "Iowan Old Style", "Palatino", "serif"]
      },
      keyframes: {
        floatY: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        float: "floatY 8s ease-in-out infinite",
        fade: "fadeIn 0.6s ease forwards"
      }
    }
  },
  plugins: []
};

export default preset;
