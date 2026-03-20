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
    name: "Trail - Visual Browsing History",
    description:
      "Your browsing sessions, reimagined.",
    version: "1.0.0",
    homepage_url: "https://gettrail.net",
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
      "scripting",
      "activeTab",
      "search",
      "bookmarks",
      "offscreen",
    ],
    commands: {
      "toggle-spotlight": {
        suggested_key: {
          default: "Ctrl+Shift+K",
          mac: "Command+Shift+K",
        },
        description: "Toggle Spotlight search",
      },
    },
    web_accessible_resources: [
      {
        resources: ['spotlight-graph.html'],
        matches: ['<all_urls>'],
      },
      {
        resources: ['assets/*.woff2'],
        matches: ['<all_urls>'],
      },
    ],
    host_permissions: [...ALLOWED_SITE_MATCH_PATTERNS],
    chrome_url_overrides: {
      newtab: "newtab.html",
    },
    side_panel: {
      default_path: "sidepanel/index.html",
    },
    action: {
      default_title: "open Trail",
      default_icon: {
        "16": "icons/trail-16.png",
        "32": "icons/trail-32.png",
        "48": "icons/trail-48.png",
        "128": "icons/trail-128.png",
      },
    },
  },
});
