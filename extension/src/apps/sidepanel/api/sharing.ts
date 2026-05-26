import { treeService } from "@shared/transport/proxy-clients.js";
import type { ImportShareResult } from "@features/sharing/share-api.js";

/**
 * Confirm a pending shared-trail import from the sidepanel. The actual
 * import (network + DB write) runs in the background; this is the proxy
 * call. Surfaced by `ShareImportPrompt` when the user accepts.
 */
export async function confirmShareImport(code: string): Promise<ImportShareResult> {
  return treeService.importSharedTrail({ code });
}
