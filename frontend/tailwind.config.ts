import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      colors: {
        ink: "#0b0d12",
        slate: "#111827",
        sand: "#f7f2ea",
        moss: "#2f6f5e",
        coral: "#f26f5b",
        gold: "#e5b867",
        ocean: "#1b4d6b",
        sky: "#87c9f0",
      },
      fontFamily: {
        sans: ["Work Sans", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 20px 60px rgba(27, 77, 107, 0.25)",
        card: "0 18px 45px rgba(11, 13, 18, 0.12)",
      },
      borderRadius: {
        xl: "1.25rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
