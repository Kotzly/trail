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
  vite: () => ({
    plugins: [react()],
    esbuild: {
      jsx: "automatic",
      jsxImportSource: "react",
    },
    optimizeDeps: {
      // Pre-bundle icon barrel so dev HMR doesn't fetch each icon's ESM
      // module individually on every change. `lucide-react` is the
      // project's `components.json` icon library; all icon usage goes
      // through the `Icons` registry in `@ui/components/icons`.
      include: ["lucide-react"],
    },
  }),
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
    web_accessible_resources: [
      {
        resources: ['assets/*.woff2'],
        matches: ['<all_urls>'],
      },
    ],
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
