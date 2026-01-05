/**
 * Tab Manager for multi-tab mode.
 * Tracks node ↔ tab relationships globally across all windows and keeps an
 * LRU list for enforcing tab limits.
 */
export class TabManager {
  constructor() {
    // Primary tab for each node: nodeId -> { windowId, tabId }
    this.globalNodeToTab = new Map();

    // All tabs for each node: nodeId -> Array<{ windowId, tabId }>
    this.globalNodeTabs = new Map();

    // Reverse lookup: tabId -> nodeId
    this.globalTabToNode = new Map();

    // Global LRU order of tabIds (oldest first)
    this.globalLruOrder = [];
  }

  /**
   * Register a tab for a node (global across windows).
   * Reassigns the tab if it previously belonged to another node.
   */
  registerGlobal(nodeId, windowId, tabId) {
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

  /**
   * Ensure the node has a tab list and return it.
   * @private
   */
  _ensureNodeTabs(nodeId) {
    if (!this.globalNodeTabs.has(nodeId)) {
      this.globalNodeTabs.set(nodeId, []);
    }
    return this.globalNodeTabs.get(nodeId);
  }

  /**
   * Remove a tab from a node's tab list.
   * @private
   */
  _removeTabFromNodeGlobal(nodeId, tabId) {
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

  /**
   * Get the first tab entry for a node (or null).
   * @private
   */
  _getFirstTabForNode(nodeId) {
    const tabs = this.globalNodeTabs.get(nodeId);
    return tabs?.[0] || null;
  }

  /**
   * Get all tabs for a node across all windows.
   * @param {number} nodeId
   * @returns {Array<{windowId:number, tabId:number}>}
   */
  getTabsForNode(nodeId) {
    return this.globalNodeTabs.get(nodeId) || [];
  }

  /**
   * Get total tab count for a node across all windows.
   * @param {number} nodeId
   * @returns {number}
   */
  getTabCountForNode(nodeId) {
    return this.getTabsForNode(nodeId).length;
  }

  /**
   * Get the next tab for a node (cycles globally).
   * @param {number} nodeId
   * @param {number|null} currentTabId
   * @returns {{windowId:number, tabId:number}|null}
   */
  getNextTabForNode(nodeId, currentTabId = null) {
    const tabs = this.getTabsForNode(nodeId);
    if (tabs.length <= 1) return null;

    if (currentTabId === null) {
      return tabs[0];
    }

    const index = tabs.findIndex(t => t.tabId === currentTabId);
    if (index === -1) return tabs[0];

    const nextIndex = (index + 1) % tabs.length;
    return tabs[nextIndex];
  }

  /**
   * Mark a tab as recently used in global LRU.
   */
  touchGlobal(tabId) {
    const index = this.globalLruOrder.indexOf(tabId);
    if (index > -1) {
      this.globalLruOrder.splice(index, 1);
    }
    this.globalLruOrder.push(tabId);
  }

  /**
   * Remove a tab from global LRU.
   * @private
   */
  _removeFromGlobalLru(tabId) {
    const index = this.globalLruOrder.indexOf(tabId);
    if (index > -1) {
      this.globalLruOrder.splice(index, 1);
    }
  }

  /**
   * Get the primary tab for a node.
   */
  getTabForNodeGlobal(nodeId) {
    const primary = this.globalNodeToTab.get(nodeId);
    if (primary) return primary;
    const fallback = this._getFirstTabForNode(nodeId);
    return fallback ? { ...fallback } : null;
  }

  /**
   * Get the node ID for a tab (global mode).
   */
  getNodeForTabGlobal(tabId) {
    const nodeId = this.globalTabToNode.get(tabId);
    return nodeId !== undefined ? nodeId : null;
  }

  /**
   * Get all nodes that currently have at least one open tab.
   * @returns {Set<number>}
   */
  getAllOpenNodes() {
    const openNodes = new Set();
    for (const nodeId of this.globalNodeToTab.keys()) {
      openNodes.add(nodeId);
    }
    for (const nodeId of this.globalNodeTabs.keys()) {
      openNodes.add(nodeId);
    }
    return openNodes;
  }

  /**
   * Unregister a tab (when it is closed).
   */
  unregisterGlobal(tabId) {
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

  /**
   * Update stored windowId for a tab (when moved between windows).
   */
  updateTabWindow(tabId, newWindowId) {
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

  /**
   * Close oldest tab globally if the limit is exceeded (skips pinned nodes).
   */
  async closeOldestGlobalIfNeeded(limit, tree = null) {
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

  /**
   * Serialize state for debugging.
   */
  toJSON() {
    const result = {
      globalNodeToTab: {},
      globalNodeTabs: {},
      globalTabToNode: Object.fromEntries(this.globalTabToNode),
      globalLruOrder: [...this.globalLruOrder]
    };

    for (const [nodeId, entry] of this.globalNodeToTab) {
      result.globalNodeToTab[nodeId] = entry;
    }

    for (const [nodeId, tabs] of this.globalNodeTabs) {
      result.globalNodeTabs[nodeId] = tabs;
    }

    return result;
  }
}

// Singleton instance
export const tabManager = new TabManager();
