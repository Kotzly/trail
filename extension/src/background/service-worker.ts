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
import { initAuth, subscribeAuthState } from "@shared/auth/auth-orchestrator.js";
import { startSyncEngine } from "./sync/sync-engine.js";
import { EXTENSION_MESSAGE, fireExtensionEvent } from "@shared/transport/extension-messaging.js";
import { treeStorage } from "./services/tree-storage.js";
import { tabManager } from "./state/tab-manager.js";

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
// Also kicks off local schema migrations so the extension starts each
// upgrade with its persisted shape matching the current code.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    captureEvent("install", { version: chrome.runtime.getManifest().version });
  } else if (details.reason === "update") {
    captureEvent("update", {
      version: chrome.runtime.getManifest().version,
      previousVersion: details.previousVersion ?? null,
    });
    // Run migrations on upgrade. Module-load migration below also runs,
    // but singleflight dedupes.
    void import("./services/migrations.js").then(({ runMigrations }) => runMigrations());
  }
});

// MV3 service workers are evicted aggressively. Flush pending tree saves
// before termination so the 1.5s debounced writes don't disappear with
// the worker. This is best-effort — Chrome may terminate before the
// flush resolves — but it closes the common-case data-loss window.
chrome.runtime.onSuspend.addListener(() => {
  log.info("Service worker suspending — flushing pending saves");
  void treeStorage.flushSaveNow();
});

// Initialize all modules
void initBackendConfig();

// Run local schema migrations before anything else touches storage.
void import("./services/migrations.js").then(({ runMigrations }) => runMigrations());
registerProxyServices();
registerExtensionMessaging();
initWebNavigation();
initTabsLifecycle();
// Hydrate lastNodeByTab from session storage BEFORE syncOpenTabs so
// opener-based parent inference works immediately on SW wake.
void tabManager.hydrate().then(() => syncOpenTabs());
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

// Auth + sync — no-op when env vars missing or user not signed in.
void initAuth().then((state) => {
  fireExtensionEvent(EXTENSION_MESSAGE.AUTH_STATE, state);
  subscribeAuthState((next) => {
    fireExtensionEvent(EXTENSION_MESSAGE.AUTH_STATE, next);
  });
  startSyncEngine();
});

// Service worker initialized.
