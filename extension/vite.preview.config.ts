import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone Vite config for the local preview harness. Not part of the
// WXT extension build — exists so `pnpm preview:ui` can render the sidepanel
// UI against fake data, without the extension background, service worker,
// or chrome APIs.
//
// Alias ordering matters: specific module redirects MUST come before the
// `@shared` / `@apps` prefix aliases, otherwise the prefix wins and the
// redirect never fires.

export default defineConfig({
  root: resolve(__dirname, "preview"),
  plugins: [react()],
  server: {
    host: "localhost",
    port: 5174,
    open: false,
    fs: { allow: [resolve(__dirname)] },
  },
  resolve: {
    alias: [
      // ---------- specific module redirects (FIRST) ----------
      {
        find: /^wxt\/browser$/,
        replacement: resolve(__dirname, "preview/mocks/webext.ts"),
      },
      {
        find: /^@shared\/platform\/webext(\.js)?$/,
        replacement: resolve(__dirname, "preview/mocks/webext.ts"),
      },
      {
        find: /^@shared\/lib\/observability(\.js)?$/,
        replacement: resolve(__dirname, "preview/mocks/observability.ts"),
      },
      {
        find: /^@shared\/config\/backend(\.js)?$/,
        replacement: resolve(__dirname, "preview/mocks/backend.ts"),
      },
      {
        find: /^@shared\/transport\/proxy-clients(\.js)?$/,
        replacement: resolve(__dirname, "preview/mocks/proxy-clients.ts"),
      },
      {
        find: /^@shared\/lib\/supabase(\.js)?$/,
        replacement: resolve(__dirname, "preview/mocks/backend.ts"),
      },

      // ---------- prefix aliases (mirror wxt.config.ts) ----------
      { find: "@apps", replacement: resolve(__dirname, "src/apps") },
      { find: "@ui", replacement: resolve(__dirname, "src/ui") },
      { find: "@features", replacement: resolve(__dirname, "src/features") },
      { find: "@background", replacement: resolve(__dirname, "src/background") },
      { find: "@shared", replacement: resolve(__dirname, "src/shared") },
      { find: "@entrypoints", replacement: resolve(__dirname, "src/entrypoints") },
      { find: "@content", replacement: resolve(__dirname, "src/content") },
    ],
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  optimizeDeps: {
    include: ["lucide-react"],
    // Force re-bundle so the proxy-service stub doesn't get cached.
    force: true,
  },
});
