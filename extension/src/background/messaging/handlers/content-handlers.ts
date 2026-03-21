// messaging/handlers/content-handlers.ts
import { shouldTrackUrl } from "../../utils/url-utils.js";
import { treeStorage } from "../../services/tree-storage.js";
import { tabManager } from "../../state/tab-manager.js";
import { notifyTreeUpdate } from "../notifications.js";
import { RPC_METHOD, defineRpcHandlers, ok, err } from "@shared/rpc/contracts.js";
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
    if (!tabId) return err("No tab ID");
    const nodeId = tabManager.nodeByTab(tabId);
    if (!nodeId) return err("No node ID for given Tab ID");

    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(nodeId);
    if (!node) return err("No node found for given Node ID");

    const url = message.url;
    if (!shouldTrackUrl(url as Url)) return ok();

    async function handleFaviconChange(favicon: FaviconUrl) {
      if (!node) return err("No node found for given Node ID");
      if (!favicon) return err("no favicon");
      if (favicon === node.data.favicon) return ok();
      if (!shouldTrackUrl(url as Url)) return err("URL is not trackable");
      if (createUrlKey(node.data.url) !== createUrlKey(url)) return err("URL mismatch");
      node.data.favicon = favicon;
      tree.refreshSearchEntry(node.id);
      treeStorage.cacheTree(tree);
      await notifyTreeUpdate(tree, "sync");
      return ok();
    }

    async function handleTitleChange(title: Title) {
      if (!node) return err("No node found for given Node ID");
      if (!title) return err("no title");
      if (title === node.data.title) return ok();
      if (!shouldTrackUrl(url as Url)) return err("URL is not trackable");
      if (createUrlKey(node.data.url) !== createUrlKey(url)) return err("URL mismatch");
      node.data.title = title;
      tree.refreshSearchEntry(node.id);
      treeStorage.cacheTree(tree);
      await notifyTreeUpdate(tree, "sync");
      return ok();
    }

    return message.favicon
      ? handleFaviconChange(message.favicon)
      : message.title
        ? handleTitleChange(message.title)
        : err("No favicon or title");
  },
});
