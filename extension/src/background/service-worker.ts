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
import { initAuth, subscribeAuthState, getAuthState } from "@shared/auth/auth-orchestrator.js";
import { startSyncEngine, handlePullAlarm, SYNC_PULL_ALARM } from "./sync/sync-engine.js";
import { EXTENSION_MESSAGE, fireExtensionEvent } from "@shared/transport/extension-messaging.js";
import { treeStorage } from "./services/tree-storage.js";
import { tabManager } from "./state/tab-manager.js";
import { hydrateNavPatterns } from "./navigation/nav-pattern-tracker.js";
import { getSupabaseClient } from "@shared/lib/supabase.js";

const log = createLogger("service-worker");

const AUTH_REFRESH_ALARM = "trail-auth-refresh";
const AUTH_REFRESH_PERIOD_MINUTES = 30;

// Catch unhandled promise rejections so they don't silently disappear
// in the service worker context.
self.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  log.error("Unhandled rejection in service worker", {
    error: event.reason instanceof Error ? event.reason.message : String(event.reason),
  });
  captureError(event.reason, { surface: "background", kind: "unhandled_rejection" });
});

void initObservability("background");

// chrome.alarms.onAlarm MUST be registered synchronously at module top
// level (not inside an async callback) so Chrome can replay the event
// to wake the SW. The handler itself is allowed to be async.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_PULL_ALARM) {
    void handlePullAlarm().catch((error) => {
      captureError(error, { surface: "background", kind: "pull_alarm" });
    });
    return;
  }
  if (alarm.name === AUTH_REFRESH_ALARM) {
    void refreshAuthSession().catch((error) => {
      captureError(error, { surface: "background", kind: "auth_refresh_alarm" });
    });
  }
});

async function refreshAuthSession(): Promise<void> {
  if (getAuthState().status !== "signed-in") return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.refreshSession();
  if (error) {
    log.warn("refreshSession failed", { error: error.message });
  }
}

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
  }
  // Run migrations on install AND update; the singleflight inside
  // runMigrations dedupes if the module-load path also fires.
  void import("./services/migrations.js").then(({ runMigrations }) => runMigrations());

  // (Re)create the auth-refresh alarm on install/update so existing
  // installs pick it up without needing a user action.
  chrome.alarms.create(AUTH_REFRESH_ALARM, {
    periodInMinutes: AUTH_REFRESH_PERIOD_MINUTES,
  });
});

// MV3 service workers are evicted aggressively. Flush pending tree saves
// before termination so the 1.5s debounced writes don't disappear with
// the worker. This is best-effort — Chrome may terminate before the
// flush resolves — but it closes the common-case data-loss window.
chrome.runtime.onSuspend.addListener(() => {
  log.info("Service worker suspending — flushing pending saves");
  void treeStorage.flushSaveNow();
  void CommandManager.flushNow?.();
});

// Initialize all modules
void initBackendConfig();

registerProxyServices();
registerExtensionMessaging();
initWebNavigation();
initTabsLifecycle();

// Hydrate lastNodeByTab from session storage BEFORE syncOpenTabs so
// opener-based parent inference works immediately on SW wake. Also
// wire up tree-level integrations so TabManager can validate nodeIds
// and respond to deletions.
tabManager.setTreeAccessor(() => treeStorage.cachedTree);
void Promise.all([tabManager.hydrate(), hydrateNavPatterns()]).then(async () => {
  const tree = await treeStorage.getOrCreateTree();
  tree.onNodesDeleted((ids) => tabManager.onNodesDeleted(ids));
  await syncOpenTabs();
});
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
// Ensure the alarm exists even on regular SW wake (onInstalled only
// fires on install/update).
chrome.alarms.create(AUTH_REFRESH_ALARM, {
  periodInMinutes: AUTH_REFRESH_PERIOD_MINUTES,
});

void initAuth().then((state) => {
  fireExtensionEvent(EXTENSION_MESSAGE.AUTH_STATE, state);
  subscribeAuthState((next) => {
    fireExtensionEvent(EXTENSION_MESSAGE.AUTH_STATE, next);
  });
  startSyncEngine();
});

// Service worker initialized.
