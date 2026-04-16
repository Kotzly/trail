// background/service-worker.ts
import { initWebNavigation } from "./navigation/webnavigation.js";
import { initTabsLifecycle } from "./tabs/lifecycle.js";
import { syncOpenTabs } from "./tabs/sync-open-tabs.js";
import { CommandManager } from "@shared/lib/commands.js";
import { initBackendConfig } from "@shared/config/backend.js";
import { createLogger } from "@shared/lib/logger.js";
import { warmLayoutPositions } from "./services/layout-precompute.js";
import { registerProxyServices } from "./transport/register-proxy-services.js";
import { registerExtensionMessaging } from "./transport/register-extension-messaging.js";
import { captureError, captureEvent, initObservability } from "@shared/lib/observability.js";

const log = createLogger("service-worker");

// Catch unhandled promise rejections so they don't silently disappear
// in the service worker context.
self.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  log.error("Unhandled rejection in service worker", {
    error: event.reason instanceof Error ? event.reason.message : String(event.reason),
  });
  captureError(event.reason, { surface: "background", kind: "unhandled_rejection" });
});

void initObservability("background");

// Install / update tracking — fires once per install and once per version change.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    captureEvent("install", { version: chrome.runtime.getManifest().version });
  } else if (details.reason === "update") {
    captureEvent("update", {
      version: chrome.runtime.getManifest().version,
      previousVersion: details.previousVersion ?? null,
    });
  }
});

// Initialize all modules
void initBackendConfig();
registerProxyServices();
registerExtensionMessaging();
initWebNavigation();
initTabsLifecycle();
void syncOpenTabs();
void CommandManager.init();

if (chrome.sidePanel?.setPanelBehavior) {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err: unknown) => {
    log.warn("Failed to set side panel behavior", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

// Pre-compute layout positions so sidepanel opens instantly
void warmLayoutPositions();

// Service worker initialized.
