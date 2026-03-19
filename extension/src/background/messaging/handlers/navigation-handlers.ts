import type { TabId } from "@shared/types/ids.js";
import { RPC_METHOD, defineRpcHandlers, ok, err } from "@shared/rpc/contracts.js";
import { tabManager } from "../../state/tab-manager.js";
import { treeStorage } from "../../services/tree-storage.js";
import { notifyTreeUpdate } from "../notifications.js";
import { getActiveTab } from "../../tabs/lifecycle.js";
import { tempSelectionManager } from "../../services/temporary-selection.js";
import { syncOpenTabs } from "../../tabs/sync-open-tabs.js";
import { getEditorState } from "./editor-handlers.js";
import { browser } from "@shared/platform/webext.js";
import { markNodeVisited } from "../../state/node-recency.js";

async function focusTab(tabId: TabId): Promise<boolean> {
  try {
    const tab = await browser.tabs.get(tabId);
    if (tab.windowId !== undefined) {
      await browser.windows.update(tab.windowId, { focused: true });
    }
    await browser.tabs.update(tabId, { active: true });
    return true;
  } catch {
    return false;
  }
}

export const navigationHandlers = defineRpcHandlers({
  async [RPC_METHOD.NAVIGATE_TO](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err("Node not found");

    if (getEditorState().active) {
      tree.setCurrentById(message.nodeId);
      treeStorage.cacheTree(tree);
      await notifyTreeUpdate(tree, "set-current", {
        focusNodeId: message.nodeId,
        mode: "force",
      });
      return ok();
    }

    if (tabManager.openNodes().size === 0) {
      await syncOpenTabs();
    }

    const activeTab = await getActiveTab();
    const activeTabId = activeTab?.id as TabId | undefined;
    const activeNodeId = activeTabId ? tabManager.nodeByTab(activeTabId) : undefined;
    const shouldCycle = activeTabId !== undefined && activeNodeId === message.nodeId;

    if (shouldCycle) {
      const nextTabId = tabManager.getNextTabForNode(message.nodeId, activeTabId);
      if (nextTabId && nextTabId !== activeTabId) {
        tabManager.suppressNextTouch(nextTabId as TabId);
        const focused = await focusTab(nextTabId as TabId);
        if (focused) {
          markNodeVisited(tree, message.nodeId);
          tree.setCurrentById(message.nodeId);
          treeStorage.cacheTree(tree);
          await notifyTreeUpdate(tree, "set-current", {
            focusNodeId: message.nodeId,
            mode: "force",
          });
          return ok();
        }
        tabManager.unregister(nextTabId as TabId);
      }
    }

    const tabsArray = tabManager.getTabsByRecency(message.nodeId);
    for (const tabId of tabsArray) {
      const focused = await focusTab(tabId as TabId);
      if (focused) {
        tabManager.touch(tabId as TabId, message.nodeId);
        markNodeVisited(tree, message.nodeId);
        tree.setCurrentById(message.nodeId);
        treeStorage.cacheTree(tree);
        await notifyTreeUpdate(tree, "set-current", { focusNodeId: message.nodeId, mode: "force" });
        return ok();
      }
      tabManager.unregister(tabId as TabId);
    }

    const targetWindow = await browser.windows.getLastFocused();
    const created = await browser.tabs.create({
      windowId: targetWindow?.id,
      url: node.data.url,
      active: true,
    });

    if (created.id !== undefined) {
      const lastUsed = Number.isFinite(created.lastAccessed) ? created.lastAccessed : undefined;
      const registerOptions = lastUsed === undefined ? { touch: true } : { touch: true, lastUsed };
      tabManager.register(message.nodeId, created.id as TabId, registerOptions);
      markNodeVisited(tree, message.nodeId, lastUsed);
    }

    tree.setCurrentById(message.nodeId);
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, "set-current", { focusNodeId: message.nodeId, mode: "force" });

    return ok();
  },

  async [RPC_METHOD.PREVIEW_NODE](message) {
    if (getEditorState().active) {
      return ok();
    }

    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err("Node not found");

    const tabsArray = tabManager.getTabsByRecency(message.nodeId);
    if (tabsArray.length === 0) {
      return ok();
    }
    for (const tabId of tabsArray) {
      tabManager.suppressNextActivate(tabId as TabId);
      const focused = await focusTab(tabId as TabId);
      if (focused) {
        return ok();
      }
      tabManager.unregister(tabId as TabId);
    }
    return ok();
  },

  async [RPC_METHOD.BEGIN_TEMP_SELECTION](message) {
    try {
      const sessionId = await tempSelectionManager.begin(
        message.baseNodeId ?? null,
        message.options,
      );
      return ok({ sessionId });
    } catch (error) {
      return err(error instanceof Error ? error.message : "Failed to begin temp selection");
    }
  },

  async [RPC_METHOD.PREVIEW_TEMP_SELECTION](message) {
    try {
      const result = await tempSelectionManager.preview(
        message.sessionId,
        message.nodeId,
        message.tabId,
      );
      return ok(result);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Failed to preview temp selection");
    }
  },

  async [RPC_METHOD.ACCEPT_TEMP_SELECTION](message) {
    try {
      await tempSelectionManager.accept(message.sessionId, message.nodeId);
      return ok();
    } catch (error) {
      return err(error instanceof Error ? error.message : "Failed to accept temp selection");
    }
  },

  async [RPC_METHOD.CANCEL_TEMP_SELECTION](message) {
    try {
      await tempSelectionManager.cancel(message.sessionId, { keepSession: message.keepSession } as {
        keepSession?: boolean;
      });
      return ok();
    } catch (error) {
      return err(error instanceof Error ? error.message : "Failed to cancel temp selection");
    }
  },

  async [RPC_METHOD.END_TEMP_SELECTION](message) {
    tempSelectionManager.end(message.sessionId);
    return ok();
  },

  async [RPC_METHOD.SET_CURRENT](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err("Node not found");

    if (getEditorState().active) {
      tree.setCurrentById(message.nodeId);
      treeStorage.cacheTree(tree);
      await notifyTreeUpdate(tree, "set-current", {
        focusNodeId: message.nodeId,
        mode: "force",
      });
      return ok();
    }

    if (tabManager.openNodes().size === 0) {
      await syncOpenTabs();
    }

    const tabsArray = tabManager.getTabsByRecency(message.nodeId);
    for (const tabId of tabsArray) {
      const focused = await focusTab(tabId as TabId);
      if (focused) {
        tabManager.touch(tabId as TabId, message.nodeId);
        markNodeVisited(tree, message.nodeId);
        tree.setCurrentById(message.nodeId);
        treeStorage.cacheTree(tree);
        await notifyTreeUpdate(tree, "set-current", { focusNodeId: message.nodeId, mode: "force" });
        return ok();
      }
      tabManager.unregister(tabId as TabId);
    }

    const targetWindow = await browser.windows.getLastFocused();
    const created = await browser.tabs.create({
      windowId: targetWindow?.id,
      url: node.data.url,
      active: true,
    });

    if (created.id !== undefined) {
      const lastUsed = Number.isFinite(created.lastAccessed) ? created.lastAccessed : undefined;
      const registerOptions = lastUsed === undefined ? { touch: true } : { touch: true, lastUsed };
      tabManager.register(message.nodeId, created.id as TabId, registerOptions);
      markNodeVisited(tree, message.nodeId, lastUsed);
    }

    tree.setCurrentById(message.nodeId);
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, "set-current", { focusNodeId: message.nodeId, mode: "force" });
    return ok();
  },

  async [RPC_METHOD.OPEN_IN_NEW_TAB](message) {
    if (getEditorState().active) {
      return ok();
    }

    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err("Node not found");

    const tab = await browser.tabs.create({ url: node.data.url, active: false });
    if (tab.id !== undefined) {
      const lastUsed = Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : undefined;
      const registerOptions =
        lastUsed === undefined ? { touch: false } : { touch: false, lastUsed };
      tabManager.register(message.nodeId, tab.id as TabId, registerOptions);
    }

    await notifyTreeUpdate(tree, "tabs");
    return ok();
  },
});
