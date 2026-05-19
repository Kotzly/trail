import { createLogger } from "@shared/lib/logger.js";
import { captureEvent } from "@shared/lib/observability.js";
import { getAuthState } from "@shared/auth/auth-orchestrator.js";
import { pendingShareImportItem } from "@shared/config/storage-items.js";
import { browser, openSidebarForTab } from "@shared/platform/webext.js";
import type {
  ImportSharedTrailFromSiteData,
  ImportSharedTrailFromSiteReply,
} from "@shared/transport/protocols.js";
import { importSharedTrail } from "@features/sharing/share-api.js";
import { periodicPull } from "@background/sync/sync-engine.js";

const log = createLogger("share-from-site");

/**
 * Handle `EXTENSION_MESSAGE.IMPORT_SHARED_TRAIL_FROM_SITE` — the bridge
 * call that originates on `/s/<code>` in the marketing site. Three
 * paths:
 *
 * 1. Extension is signed-out → save the code as a pending import,
 *    open the sidepanel so the user lands on the sign-in surface,
 *    and reply with `needs-signin`. The sidepanel will complete the
 *    import after first successful sign-in (see [[features/sharing]]
 *    pending-import consumer wiring).
 *
 * 2. Extension is signed-in and the import succeeds → clear any
 *    stale pending code, trigger a sync pull so the new trail
 *    surfaces in the index without waiting for the 60 s alarm, and
 *    open the sidepanel to bring the user back into the extension.
 *
 * 3. Import fails with a known error → return the mapped error code
 *    so the marketing page can render the right copy.
 */
export async function handleImportSharedTrailFromSite(
  data: ImportSharedTrailFromSiteData,
  sender: chrome.runtime.MessageSender,
): Promise<ImportSharedTrailFromSiteReply> {
  const code = data.code?.trim();
  if (!code) {
    return { ok: false, error: "unknown", message: "empty_code" };
  }

  const auth = getAuthState();
  if (auth.status !== "signed-in") {
    await pendingShareImportItem.setValue({ code, queuedAt: Date.now() });
    captureEvent("share_import_needs_signin");
    await tryOpenPanel(sender);
    return { ok: false, error: "needs-signin" };
  }

  const result = await importSharedTrail(code);
  if (!result.ok) {
    log.warn("share import failed", { error: result.error });
    return result;
  }

  await pendingShareImportItem.setValue(null);
  captureEvent("share_import_success");
  // Fire-and-forget — failure here is non-fatal; the next alarm picks up.
  void periodicPull().catch((err) => log.warn("post-import pull failed", { err: String(err) }));
  await tryOpenPanel(sender);

  return {
    ok: true,
    trailId: result.trailId,
    label: result.label,
    nodeCount: result.nodeCount,
  };
}

async function tryOpenPanel(sender: chrome.runtime.MessageSender): Promise<void> {
  const tabId = sender.tab?.id;
  if (!tabId) return;
  try {
    await openSidebarForTab(tabId);
  } catch (err) {
    // The user explicitly clicked Import, so opening the panel is
    // best-effort UX. Don't fail the message reply just because the
    // sidebar API balks.
    log.info("openSidebarForTab failed (non-fatal)", { err: String(err) });
    void browser; // keep import warm for callers expecting browser
  }
}
