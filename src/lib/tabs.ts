import { NodeId, TabId, WindowId } from "../types/ids";
import { NavigationTree } from "../types/tree";

/**
 * Tab Manager for multi-tab mode.
 * Tracks node ↔ tab relationships globally across all windows and keeps an
 * LRU list for enforcing tab limits.
 */

type WTpair = {
    windowId: WindowId,
    tabId: TabId
}

class TabManagerState {
    globalNodeToTab: Map<NodeId, WTpair>;
    globalNodeTabs: Map<NodeId, WTpair[]>;
    globalTabToNode: Map<TabId, NodeId>;
    globalLruOrder: TabId[];

    constructor() {
        this.globalNodeToTab = new Map<NodeId, WTpair>();
        this.globalNodeTabs = new Map<NodeId, WTpair[]>();
        this.globalTabToNode = new Map<TabId, NodeId>();
        this.globalLruOrder = [];
    }

    // todo: add methods to get, set, delete, etc. ???
}


export class TabManager {
    globalNodeToTab: Map<NodeId, WTpair>;
    globalNodeTabs: Map<NodeId, WTpair[]>;
    globalTabToNode: Map<TabId, NodeId>;
    globalLruOrder: TabId[];

    constructor() {
        this.globalNodeToTab = new Map<NodeId, WTpair>();
        this.globalNodeTabs = new Map<NodeId, WTpair[]>();
        this.globalTabToNode = new Map<TabId, NodeId>();
        this.globalLruOrder = [];
    }

    // Register a tab for a node (global across windows).
    // Reassigns the tab if it previously belonged to another node.
    registerGlobal(nodeId: NodeId, windowId: WindowId, tabId: TabId) {
      const previousNodeId = this.globalTabToNode.get(tabId);
  
      if (previousNodeId !== undefined) {
        this._removeTabFromNodeGlobal(previousNodeId, tabId);
        const previousPrimary = this.globalNodeToTab.get(previousNodeId);
        if (previousPrimary?.tabId === tabId) {
          const replacement = this._getFirstTabForNode(previousNodeId);
          if (replacement) {
            this.globalNodeToTab.set(previousNodeId, replacement);
          } else {
            this.globalNodeToTab.delete(previousNodeId);
          }
        }
      }
  
      const tabs = this.globalNodeTabs.get(nodeId) || [];
      const existing = tabs.find(t => t.tabId === tabId);
  
      if (existing) {
        existing.windowId = windowId;
      } else {
        tabs.push({ windowId, tabId });
      }
  
      this.globalNodeTabs.set(nodeId, tabs);
      this.globalNodeToTab.set(nodeId, { windowId, tabId });
      this.globalTabToNode.set(tabId, nodeId);
      this.touchGlobal(tabId);
    }
  
    // Ensure the node has a tab list and return it.
    private _ensureNodeTabs(nodeId: NodeId): WTpair[] | undefined {
      if (!this.globalNodeTabs.has(nodeId)) {
        this.globalNodeTabs.set(nodeId, []);
        }
        return this.globalNodeTabs.get(nodeId);
    }
  
    // Remove a tab from a node's tab list.
    private _removeTabFromNodeGlobal(nodeId: NodeId, tabId: TabId) {
      const tabs = this.globalNodeTabs.get(nodeId);
      if (!tabs) return;
  
      const index = tabs.findIndex(t => t.tabId === tabId);
      if (index !== -1) {
        tabs.splice(index, 1);
        if (tabs.length === 0) {
          this.globalNodeTabs.delete(nodeId);
        } else {
          this.globalNodeTabs.set(nodeId, tabs);
        }
      }
    }
  
    // Get the first tab entry for a node (or null).
    private _getFirstTabForNode(nodeId: NodeId): WTpair | null {
      const tabs = this.globalNodeTabs.get(nodeId);
      return tabs?.[0] || null;
    }
  
    // Get all tabs for a node across all windows.
    getTabsForNode(nodeId: NodeId): WTpair[] {
      return this.globalNodeTabs.get(nodeId) || [];
    }
  
    getTabCountForNode(nodeId: NodeId): number {
      return this.getTabsForNode(nodeId).length;
    }
  
    getNextTabForNode(nodeId: NodeId, currentTabId: TabId | null = null): WTpair | null {
      const tabs = this.getTabsForNode(nodeId);
      if (tabs.length <= 1) return null;
  
      if (currentTabId === null) {
        return tabs[0] || null;
      }
  
      const index = tabs.findIndex(t => t.tabId === currentTabId);
      if (index === -1) return tabs[0] || null;
  
      const nextIndex = (index + 1) % tabs.length;
      return tabs[nextIndex] || null;
    }
  
    // Mark a tab as recently used in global LRU.
    touchGlobal(tabId: TabId) {
      const index = this.globalLruOrder.indexOf(tabId);
      if (index > -1) {
        this.globalLruOrder.splice(index, 1);
      }
      this.globalLruOrder.push(tabId);
    }
  
    // Remove a tab from global LRU.
    private _removeFromGlobalLru(tabId: TabId) {
      const index = this.globalLruOrder.indexOf(tabId);
      if (index > -1) {
        this.globalLruOrder.splice(index, 1);
      }
    }
  
    // Get the primary tab for a node.
    getTabForNodeGlobal(nodeId: NodeId): WTpair | null {
      const primary = this.globalNodeToTab.get(nodeId);
      if (primary) return primary;
      const fallback = this._getFirstTabForNode(nodeId);
      return fallback ? { ...fallback } : null;
    }
  
    // Get the node ID for a tab (global mode).
    getNodeForTabGlobal(tabId: TabId): NodeId | null {
      const nodeId = this.globalTabToNode.get(tabId);
      return nodeId !== undefined ? nodeId : null;
    }
  
    // Get all nodes that currently have at least one open tab.
    getAllOpenNodes(): Set<NodeId> {
      const openNodes = new Set<NodeId>();
      for (const nodeId of this.globalNodeToTab.keys() as Iterable<NodeId>) {
        openNodes.add(nodeId);
      }
      for (const nodeId of this.globalNodeTabs.keys() as Iterable<NodeId>) {
        openNodes.add(nodeId);
      }
      return openNodes;
    }
  
    // Unregister a tab (when it is closed).
    unregisterGlobal(tabId: TabId) {
      const nodeId = this.globalTabToNode.get(tabId);
      if (nodeId !== undefined) {
        const primary = this.globalNodeToTab.get(nodeId);
        this._removeTabFromNodeGlobal(nodeId, tabId);
  
        if (primary?.tabId === tabId) {
          const replacement = this._getFirstTabForNode(nodeId);
          if (replacement) {
            this.globalNodeToTab.set(nodeId, replacement);
          } else {
            this.globalNodeToTab.delete(nodeId);
          }
        }
      }
  
      this.globalTabToNode.delete(tabId);
      this._removeFromGlobalLru(tabId);
    }
  
    // Update stored windowId for a tab (when moved between windows).
    updateTabWindow(tabId: TabId, newWindowId: WindowId) {
      const nodeId = this.globalTabToNode.get(tabId);
      if (nodeId === undefined) return;
  
      const tabs = this.globalNodeTabs.get(nodeId);
      if (tabs) {
        const tab = tabs.find(t => t.tabId === tabId);
        if (tab) {
          tab.windowId = newWindowId;
        }
      }
  
      const primary = this.globalNodeToTab.get(nodeId);
      if (primary?.tabId === tabId) {
        this.globalNodeToTab.set(nodeId, { windowId: newWindowId, tabId });
      }
    }
  
    // Close oldest tab globally if the limit is exceeded (skips pinned nodes).
    async closeOldestGlobalIfNeeded(limit: number, tree: NavigationTree | null = null): Promise<TabId | null> {
      if (limit === 0) return null; // Unlimited
  
      const count = this.globalTabToNode.size;
      if (count <= limit) return null;
  
      let tabIdToClose = null;
      for (const tabId of this.globalLruOrder) {
        const nodeId = this.globalTabToNode.get(tabId);
        if (nodeId !== undefined && tree) {
          const node = tree.findById(nodeId);
          if (node?.pinned) continue; // Skip pinned nodes
        }
        tabIdToClose = tabId;
        break;
      }
  
      if (!tabIdToClose) return null; // All tabs are pinned
  
      try {
        await chrome.tabs.remove(tabIdToClose);
        this.unregisterGlobal(tabIdToClose);
        return tabIdToClose;
      } catch (error) {
        console.debug('Failed to close oldest tab:', error);
        return null;
      }
    }
  
    // Serialize state for debugging.
    toJSON(): TabManagerStateDebug {
      const result: TabManagerStateDebug = {
        globalNodeToTab: {},
        globalNodeTabs: {},
        globalTabToNode: {},
        globalLruOrder: [...this.globalLruOrder]
      };
  
      for (const [nodeId, entry] of this.globalNodeToTab.entries()) {
        result.globalNodeToTab[nodeId] = entry;
      }
  
      for (const [nodeId, tabs] of this.globalNodeTabs.entries()) {
        result.globalNodeTabs[nodeId] = tabs;
      }
  
      for (const [tabId, nodeId] of this.globalTabToNode.entries()) {
        result.globalTabToNode[tabId] = nodeId;
      }
  
      return result;
    }

  }

export type TabManagerStateDebug = {
    globalNodeToTab: Record<NodeId, WTpair>,
    globalNodeTabs: Record<NodeId, WTpair[]>,
    globalTabToNode: Record<TabId, NodeId>,
    globalLruOrder: TabId[]
}

export const tabManager = new TabManager();
