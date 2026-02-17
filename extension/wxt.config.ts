import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { defineConfig } from "wxt";
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
  alias: {
    "@": resolve("src/sidepanel/ui"),
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
    name: "Trail",
    description:
      "Your browsing sessions, reimagined.",
    version: "0.9.0",
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
    ],
    host_permissions: [...ALLOWED_SITE_MATCH_PATTERNS],
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
