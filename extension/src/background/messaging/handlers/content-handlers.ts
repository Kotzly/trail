// messaging/handlers/content-handlers.ts
import { isPlaceholderUrl, shouldTrackUrl } from "../../utils/url-utils.js";
import { treeStorage } from "../../services/tree-storage.js";
import { tabManager } from "../../state/tab-manager.js";
import { notifyTreeUpdate } from "../notifications.js";
import { MSG, defineHandlers } from "../../../shared/types/messages.js";
import { ok, err } from "../../../shared/types/messages.js";
import type { TabId, Url } from "../../../shared/types/ids.js";

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
    const newTitle = message.title;

    const nodeId = tabManager.nodeByTab(tabId);
    if (!nodeId) return err("No node ID for given Tab ID");
    
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(nodeId);
    if (!node) return ok();

    const url = message.url;

    if (!newTitle || !shouldTrackUrl(url as Url) || isPlaceholderUrl(url as Url)) return ok();

    if (node.data.title === newTitle) return ok();
    if (node.data.url !== url) return err("URL mismatch");
    node.data.title = newTitle;
    tree.refreshSearchEntry(nodeId);
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, 'sync');
    return ok();
  },
});
