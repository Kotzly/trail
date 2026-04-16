// messaging/handlers/content-handlers.ts
import { shouldTrackUrl } from "../../utils/url-utils.js";
import { treeStorage } from "../../services/tree-storage.js";
import { tabManager } from "../../state/tab-manager.js";
import { notifyTreeUpdate } from "../notifications.js";
import { RPC_METHOD, defineRpcHandlers } from "@shared/rpc/contracts.js";
import type { FaviconUrl, TabId, Title, Url } from "@shared/types/ids.js";
import { createUrlKey } from "@shared/lib/url-key.js";
import { type RuntimeMessageSender } from "@shared/platform/webext.js";

function getSenderTabId(sender: RuntimeMessageSender): TabId | null {
  const id = sender.tab?.id;
  return id as TabId | null;
}

/**
 * Content script -> SW handlers.
 */
export const contentHandlers = defineRpcHandlers({
  async [RPC_METHOD.TITLE_OR_FAVICON_CHANGED](message, sender) {
    const tabId = getSenderTabId(sender);
    if (!tabId) throw new Error("No tab ID");
    const nodeId = tabManager.nodeByTab(tabId);
    if (!nodeId) throw new Error("No node ID for given Tab ID");

    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(nodeId);
    if (!node) throw new Error("No node found for given Node ID");

    const url = message.url;
    if (!shouldTrackUrl(url as Url)) return;

    async function handleFaviconChange(favicon: FaviconUrl): Promise<void> {
      if (!node) throw new Error("No node found for given Node ID");
      if (!favicon) throw new Error("no favicon");
      if (favicon === node.data.favicon) return;
      if (!shouldTrackUrl(url as Url)) throw new Error("URL is not trackable");
      if (createUrlKey(node.data.url) !== createUrlKey(url)) throw new Error("URL mismatch");
      node.data.favicon = favicon;
      tree.refreshSearchEntry(node.id);
      treeStorage.cacheTree(tree);
      await notifyTreeUpdate(tree, "sync");
    }

    async function handleTitleChange(title: Title): Promise<void> {
      if (!node) throw new Error("No node found for given Node ID");
      if (!title) throw new Error("no title");
      if (title === node.data.title) return;
      if (!shouldTrackUrl(url as Url)) throw new Error("URL is not trackable");
      if (createUrlKey(node.data.url) !== createUrlKey(url)) throw new Error("URL mismatch");
      node.data.title = title;
      tree.refreshSearchEntry(node.id);
      treeStorage.cacheTree(tree);
      await notifyTreeUpdate(tree, "sync");
    }

    if (message.favicon) {
      await handleFaviconChange(message.favicon);
    } else if (message.title) {
      await handleTitleChange(message.title);
    } else {
      throw new Error("No favicon or title");
    }
  },
});
