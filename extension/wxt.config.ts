import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { defineConfig } from "wxt";
import react from "@vitejs/plugin-react";
import {
  ALLOWED_SITE_MATCH_PATTERNS,
} from "./src/shared/config/site-origins";

const DEFAULT_DEV_SERVER_PORT = 3011;

function resolveDevServerPort(): number {
  const raw = process.env.TRAIL_WXT_DEV_PORT;
  if (!raw) return DEFAULT_DEV_SERVER_PORT;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DEV_SERVER_PORT;
}

const devServerPort = resolveDevServerPort();

const chromeProfileDir = resolve(".wxt/chrome-data");
mkdirSync(chromeProfileDir, { recursive: true });

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/i18n/module"],
  vite: (env) => ({
    plugins: [react()],
    esbuild: {
      jsx: "automatic",
      jsxImportSource: "react",
    },
    // optimizeDeps is a dev-time Vite concern only; gate so it doesn't
    // leak into `wxt build` evaluation.
    ...(env.command === "serve"
      ? {
          optimizeDeps: {
            // Pre-bundle icon barrel so dev HMR doesn't fetch each icon's
            // ESM module individually on every change. Icon usage goes
            // through the `Icons` registry in `@ui/components/icons`.
            include: ["lucide-react"],
          },
        }
      : {}),
  }),
  hooks: {
    // Multi-page HTML bundles (sidepanel/settings/login) share a huge
    // "theme-provider" chunk (>680kB). Split vendor packages into named
    // chunks so each one stays under the 500kB warning and the shared
    // runtime can be cached across pages. Background and content scripts
    // use iife/inlineDynamicImports, which forbid manualChunks, so this
    // only applies to multi-page groups (Array.isArray).
    "vite:build:extendConfig"(entrypoints, config) {
      if (!Array.isArray(entrypoints) || entrypoints.length < 2) return;
      config.build ??= {};
      config.build.rollupOptions ??= {};
      config.build.rollupOptions.output ??= {};
      const output = config.build.rollupOptions.output;
      if (Array.isArray(output)) return;
      output.manualChunks = (id: string) => {
        if (!id.includes("node_modules")) return;
        // Keep React + Radix in one vendor chunk — Radix re-exports React
        // internals, splitting them triggers a circular-chunk warning.
        if (
          id.includes("/react/") ||
          id.includes("/react-dom/") ||
          id.includes("/scheduler/") ||
          id.includes("/@radix-ui/") ||
          id.includes("/radix-ui/") ||
          id.includes("/@base-ui/")
        ) {
          return "react-vendor";
        }
        if (id.includes("/@supabase/")) return "supabase";
        if (id.includes("/@sentry/")) return "sentry";
        if (id.includes("/@xyflow/") || id.includes("/d3-hierarchy/")) {
          return "flow";
        }
      };
    },
  },
  alias: {
    "@entrypoints": resolve("src/entrypoints"),
    "@apps": resolve("src/apps"),
    "@ui": resolve("src/ui"),
    "@features": resolve("src/features"),
    "@background": resolve("src/background"),
    "@content": resolve("src/content"),
    "@shared": resolve("src/shared"),
  },
  dev: {
    server: {
      host: "localhost",
      port: devServerPort,
      origin: `http://localhost:${devServerPort}`,
    },
  },
  webExt: {
    chromiumProfile: chromeProfileDir,
    keepProfileChanges: true,
  },
  manifest: {
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    version: "1.0.0",
    homepage_url: "https://gettrail.net",
    // Pins dev unpacked build to the CWS extension ID
    // (pginmdonnghdkcmnhjkniphopcfapodc) so OAuth redirect URLs,
    // chrome.storage, and chrome.identity namespaces match production.
    // This is the public key of the already-published CWS package; the store
    // ignores it on upload (it's the matching public half of the signing key).
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnC+Tyur16NrOEAY1FlUyN8NyN9NGz+3ufp0HAEqg0bF9GLYp2vtF1kJTBWKv4Y9Zsg0M4pZMNB9Bn1IPq/VC9vkVGia/OId9QmgmbC8eGO3b9F0eoHCI0uBPeAuWGNl3F6WZSwJfmpAzHbxSUePazoGQCCd7TIq9SXIL3bTVPIWkjP1kDYIh85RbfDrNk0wyGJNUf/4u//qE8Go5376Xz+kyBdf2ACig7F5FO2xTPCDvMPVInIL61EhglGY9VYWmH52ChjSpiOhj6JoSqm0ki3H4TfNhRxADD5x6qnLzmp68ifkM/ThQOPhlO9gILQMA6A+UuirCBCpfoK0KawkRawIDAQAB",
    icons: {
      "16": "icons/trail-16.png",
      "32": "icons/trail-32.png",
      "48": "icons/trail-48.png",
      "128": "icons/trail-128.png",
    },
    permissions: [
      "sidePanel",
      "storage",
      "tabs",
      "webNavigation",
      "favicon",
      "alarms",
      "identity",
    ],
    // Fonts are loaded from extension-owned pages (sidepanel, settings,
    // login, onboarding) which don't need `web_accessible_resources` —
    // they can reference chrome-extension://<id>/assets/... directly.
    // Exposing WAR to `<all_urls>` let any website fingerprint the
    // installation by loading the asset (closes P1.12).
    web_accessible_resources: [
      {
        resources: ["assets/*.woff2"],
        matches: [...ALLOWED_SITE_MATCH_PATTERNS],
      },
    ],
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; connect-src 'self' https: wss:;",
    },
    host_permissions: [...ALLOWED_SITE_MATCH_PATTERNS],
    side_panel: {
      default_path: "sidepanel/index.html",
    },
    action: {
      default_title: "__MSG_openTrail__",
      default_icon: {
        "16": "icons/trail-16.png",
        "32": "icons/trail-32.png",
        "48": "icons/trail-48.png",
        "128": "icons/trail-128.png",
      },
    },
  },
});
