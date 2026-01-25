import type { Config } from "tailwindcss";
import preset from "@trail/ui/tailwind-preset";

const config: Config = {
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/content/src/**/*.{ts,tsx}"
  ]
};

export default config;
