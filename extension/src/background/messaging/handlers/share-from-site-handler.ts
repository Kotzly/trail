import { createLogger } from "@shared/lib/logger.js";
import { captureEvent } from "@shared/lib/observability.js";
import { pendingShareImportItem } from "@shared/config/storage-items.js";
import { openSidebarForTab } from "@shared/platform/webext.js";
import type {
  ImportSharedTrailFromSiteData,
  ImportSharedTrailFromSiteReply,
} from "@shared/transport/protocols.js";

const log = createLogger("share-from-site");

/**
 * Handle `EXTENSION_MESSAGE.IMPORT_SHARED_TRAIL_FROM_SITE` — the bridge
 * call that originates on `/s/<code>` in the marketing site.
 *
 * We deliberately do NOT import here. Importing a stranger's trail into the
 * user's own data silently on a website button click is surprising; instead
 * we queue the code as a pending import and open the sidepanel, where
 * `ShareImportPrompt` shows the trail and asks the user to confirm. This
 * also moves the identity-aware checks (self-import, auth) to a surface
 * that actually knows who the user is.
 */
export async function handleImportSharedTrailFromSite(
  data: ImportSharedTrailFromSiteData,
  sender: chrome.runtime.MessageSender,
): Promise<ImportSharedTrailFromSiteReply> {
  const code = data.code?.trim();
  if (!code) {
    return { ok: false, error: "unknown", message: "empty_code" };
  }

  await pendingShareImportItem.setValue({
    code,
    queuedAt: Date.now(),
    label: data.label?.trim() || undefined,
    nodeCount: typeof data.nodeCount === "number" ? data.nodeCount : undefined,
  });
  captureEvent("share_import_prompt_queued");
  await tryOpenPanel(sender);

  return { ok: true };
}

async function tryOpenPanel(sender: chrome.runtime.MessageSender): Promise<void> {
  const tabId = sender.tab?.id;
  if (!tabId) return;
  try {
    await openSidebarForTab(tabId);
  } catch (err) {
    // The user explicitly clicked Import, so opening the panel is
    // best-effort UX. Don't fail the message reply just because the
    // sidebar API balks — the pending import is queued either way and the
    // prompt shows next time the panel opens.
    log.info("openSidebarForTab failed (non-fatal)", { err: String(err) });
  }
}
