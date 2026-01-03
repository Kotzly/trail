/**
 * Tab Manager for Multi-Tab Mode.
 * Manages mapping between tree nodes and browser tabs.
 * Implements LRU (Least Recently Used) eviction for tab limit.
 */

/**
 * TabManager class - handles node↔tab mapping and LRU eviction.
 */
export class TabManager {
  constructor() {
    // Map: nodeId -> tabId
    this.nodeToTab = new Map();
    // Map: tabId -> nodeId
    this.tabToNode = new Map();
    // Map: windowId -> Set of tabIds in that window
    this.windowTabs = new Map();
    // LRU order per window: windowId -> array of tabIds (most recent at end)
    this.lruOrder = new Map();
  }

  /**
   * Register a tab for a node.
   * @param {number} windowId
   * @param {number} nodeId
   * @param {number} tabId
   */
  register(windowId, nodeId, tabId) {
    // Remove old mappings if they exist
    const oldTabId = this.nodeToTab.get(nodeId);
    if (oldTabId !== undefined) {
      this.tabToNode.delete(oldTabId);
    }
    
    const oldNodeId = this.tabToNode.get(tabId);
    if (oldNodeId !== undefined) {
      this.nodeToTab.delete(oldNodeId);
    }

    // Set new mappings
    this.nodeToTab.set(nodeId, tabId);
    this.tabToNode.set(tabId, nodeId);

    // Track window tabs
    if (!this.windowTabs.has(windowId)) {
      this.windowTabs.set(windowId, new Set());
    }
    this.windowTabs.get(windowId).add(tabId);

    // Update LRU
    this.touch(windowId, tabId);
  }

  /**
   * Mark a tab as recently used (move to end of LRU).
   * @param {number} windowId
   * @param {number} tabId
   */
  touch(windowId, tabId) {
    if (!this.lruOrder.has(windowId)) {
      this.lruOrder.set(windowId, []);
    }
    
    const order = this.lruOrder.get(windowId);
    const index = order.indexOf(tabId);
    if (index > -1) {
      order.splice(index, 1);
    }
    order.push(tabId);
  }

  /**
   * Get the tab ID for a node.
   * @param {number} nodeId
   * @returns {number|undefined}
   */
  getTabForNode(nodeId) {
    return this.nodeToTab.get(nodeId);
  }

  /**
   * Get the node ID for a tab.
   * @param {number} tabId
   * @returns {number|undefined}
   */
  getNodeForTab(tabId) {
    return this.tabToNode.get(tabId);
  }

  /**
   * Check if a node has an open tab.
   * @param {number} nodeId
   * @returns {boolean}
   */
  isNodeOpen(nodeId) {
    return this.nodeToTab.has(nodeId);
  }

  /**
   * Get all open node IDs for a window.
   * @param {number} windowId
   * @returns {Set<number>}
   */
  getOpenNodesForWindow(windowId) {
    const tabIds = this.windowTabs.get(windowId) || new Set();
    const nodeIds = new Set();
    for (const tabId of tabIds) {
      const nodeId = this.tabToNode.get(tabId);
      if (nodeId !== undefined) {
        nodeIds.add(nodeId);
      }
    }
    return nodeIds;
  }

  /**
   * Get the number of tabs in a window.
   * @param {number} windowId
   * @returns {number}
   */
  getTabCount(windowId) {
    return this.windowTabs.get(windowId)?.size || 0;
  }

  /**
   * Get the oldest (least recently used) tab ID in a window.
   * @param {number} windowId
   * @returns {number|undefined}
   */
  getOldestTab(windowId) {
    const order = this.lruOrder.get(windowId);
    return order?.[0];
  }

  /**
   * Remove a tab from tracking (when tab is closed).
   * @param {number} tabId
   */
  unregister(tabId) {
    const nodeId = this.tabToNode.get(tabId);
    if (nodeId !== undefined) {
      this.nodeToTab.delete(nodeId);
    }
    this.tabToNode.delete(tabId);

    // Remove from window tabs and LRU
    for (const [windowId, tabs] of this.windowTabs) {
      if (tabs.has(tabId)) {
        tabs.delete(tabId);
        const order = this.lruOrder.get(windowId);
        if (order) {
          const index = order.indexOf(tabId);
          if (index > -1) {
            order.splice(index, 1);
          }
        }
        break;
      }
    }
  }

  /**
   * Remove all tabs for a window (when window is closed).
   * @param {number} windowId
   */
  unregisterWindow(windowId) {
    const tabs = this.windowTabs.get(windowId);
    if (tabs) {
      for (const tabId of tabs) {
        const nodeId = this.tabToNode.get(tabId);
        if (nodeId !== undefined) {
          this.nodeToTab.delete(nodeId);
        }
        this.tabToNode.delete(tabId);
      }
    }
    this.windowTabs.delete(windowId);
    this.lruOrder.delete(windowId);
  }

  /**
   * Close the oldest tab in a window if limit exceeded.
   * @param {number} windowId
   * @param {number} limit - Maximum tabs allowed (0 = unlimited)
   * @returns {Promise<number|null>} - The closed tab ID or null
   */
  async closeOldestIfNeeded(windowId, limit) {
    if (limit === 0) return null; // Unlimited

    const count = this.getTabCount(windowId);
    if (count <= limit) return null;

    const oldestTabId = this.getOldestTab(windowId);
    if (oldestTabId === undefined) return null;

    try {
      await chrome.tabs.remove(oldestTabId);
      this.unregister(oldestTabId);
      return oldestTabId;
    } catch (error) {
      console.debug('Failed to close oldest tab:', error);
      return null;
    }
  }

  /**
   * Serialize state for debugging.
   */
  toJSON() {
    return {
      nodeToTab: Object.fromEntries(this.nodeToTab),
      tabToNode: Object.fromEntries(this.tabToNode),
      windowTabs: Object.fromEntries(
        Array.from(this.windowTabs.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      lruOrder: Object.fromEntries(this.lruOrder)
    };
  }
}

// Singleton instance
export const tabManager = new TabManager();
