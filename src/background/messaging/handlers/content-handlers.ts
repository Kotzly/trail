// messaging/handlers/content-handlers.ts
import { shouldTrackUrl } from "../../utils/url-utils.js";
import { treeStorage } from "../../services/tree-storage.js";
import { tabManager } from "../../state/tab-manager.js";
import { notifyTreeUpdate } from "../notifications.js";
import { MSG, defineHandlers } from "../../../shared/types/messages.js";
import type { TabId } from "../../../shared/types/ids.js";
import { ok, err } from "../../../shared/types/messages.js";

function getSenderTabId(sender: chrome.runtime.MessageSender): TabId | null {
  const id = sender.tab?.id;
  return id as TabId | null;
}

/**
 * Content script -> SW handlers.
 */
export const contentHandlers = defineHandlers({
  async [MSG.TITLE_CHANGED](message, sender) {
    const tabId = getSenderTabId(sender);
    if (!tabId) return err("No tab ID");

    const url = message.url;
    const newTitle = message.title;

    if (!newTitle || !shouldTrackUrl(url)) return ok();

    try {
      const rawTabId = sender.tab?.id;
      const nodeId = typeof rawTabId === "number" ? tabManager.nodeByTab(rawTabId as TabId) : undefined;

      if (nodeId !== undefined) {
        const tree = await treeStorage.getOrCreateTree();
        const node = tree.findNodeById(nodeId);

        if (node && node.data.url === url && node.data.title !== newTitle) {
          node.data.title = newTitle;
          treeStorage.cacheTree(tree);
          await notifyTreeUpdate(tree);
        }
      }

      return ok();
    } catch (e) {
      console.debug("Title update error:", e);
      return err("Title update failed");
    }
  },
});
