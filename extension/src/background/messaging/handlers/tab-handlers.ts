import type { NodeId, TabId } from "@shared/types/ids.js";
import { RPC_METHOD, defineRpcHandlers } from "@shared/rpc/contracts.js";
import { tabManager } from "../../state/tab-manager.js";
import { notifyTreeUpdate } from "../notifications.js";
import { treeStorage } from "../../services/tree-storage.js";
import { type NavigationTree } from "../../state/nav-tree.js";
import { browser, type Tab } from "@shared/platform/webext.js";
import { createLogger } from "@shared/lib/logger.js";

const log = createLogger("tab-handlers");

export const tabHandlers = defineRpcHandlers({
  async [RPC_METHOD.GET_TABS_FOR_NODE](message) {
    const tabsForNode = tabManager.tabsByNode(message.nodeId);
    const tabIds = Array.from(tabsForNode ?? []);
    const tabs = await Promise.all(
      tabIds.map(async (tabId) => {
        try {
          return await browser.tabs.get(tabId as TabId);
        } catch (error) {
          tabManager.unregister(tabId as TabId);
          log.error("Failed to get tab", {
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      }),
    );

    return { tabs: tabs.filter((tab): tab is Tab => Boolean(tab)) };
  },

  async [RPC_METHOD.TOGGLE_MUTE](message) {
    const { nodeId, tabId } = message;

    const tabsForNode = tabManager.tabsByNode(nodeId);
    if (!tabsForNode?.has(tabId)) throw new Error("Tab not found");

    try {
      const tab = await browser.tabs.get(tabId);
      const newMuted = !tab.mutedInfo?.muted;
      await browser.tabs.update(tabId, { muted: newMuted });
    } catch (e) {
      throw new Error((e as Error).message);
    }
  },

  async [RPC_METHOD.CLOSE_TAB](message) {
    const { nodeId, tabId } = message;
    const tabsForNode = tabManager.tabsByNode(nodeId);
    if (!tabsForNode?.has(tabId)) throw new Error("Tab not found");

    const tree = await treeStorage.getOrCreateTree();
    try {
      await browser.tabs.remove(tabId);
      await unregisterTabForNode(tree, nodeId, tabId);
      await notifyTreeUpdate(tree, "tabs");
    } catch (e) {
      throw new Error((e as Error).message);
    }
  },

  async [RPC_METHOD.BULK_CLOSE_TABS](message) {
    const tree = await treeStorage.getOrCreateTree();
    const { nodeIds } = message;
    nodeIds.forEach(async (nodeId) => {
      tabManager.tabsByNode(nodeId).forEach(async (tabId) => {
        browser.tabs
          .remove(tabId)
          .catch((e) =>
            log.error("Failed to remove tab", {
              error: e instanceof Error ? e.message : String(e),
            }),
          )
          .then(async () => await unregisterTabForNode(tree, nodeId, tabId));
      });
    });

    await notifyTreeUpdate(tree, "tabs");
  },
});

async function unregisterTabForNode(
  tree: NavigationTree,
  nodeId: NodeId,
  tabId: TabId,
): Promise<void> {
  tabManager.unregister(tabId);
  if (tabManager.tabCountForNode(nodeId) === 0) {
    await notifyTreeUpdate(tree, "tabs");
  }
}
