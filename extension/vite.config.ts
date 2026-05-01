import { defineConfig } from "vite";

// WXT owns the real build pipeline via wxt.config.ts. This file exists so
// tools that expect a vite.config.* marker (e.g. shadcn CLI framework detection)
// recognize the project as Vite-based.
export default defineConfig({});
