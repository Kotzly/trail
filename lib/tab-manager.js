/**
 * Tab Manager for Multi-Tab Mode.
 * Manages mapping between tree nodes and browser tabs.
 * Implements LRU (Least Recently Used) eviction for tab limit.
 * 
 * IMPORTANT: All mappings are PER-WINDOW because nodeId is only unique
 * within a single tree/window. Different windows can have nodes with
 * the same nodeId.
 */

/**
 * TabManager class - handles node↔tab mapping and LRU eviction.
 * All mappings are per-window.
 */
export class TabManager {
  constructor() {
    // Per-window nodeId -> tabId mapping
    // Map<windowId, Map<nodeId, tabId>>
    this.windowNodeToTab = new Map();
    
    // Per-window tabId -> nodeId mapping
    // Map<windowId, Map<tabId, nodeId>>
    this.windowTabToNode = new Map();
    
    // LRU order per window: windowId -> array of tabIds (most recent at end)
    this.lruOrder = new Map();
  }

  /**
   * Ensure maps exist for a window.
   * @param {number} windowId
   */
  _ensureWindow(windowId) {
    if (!this.windowNodeToTab.has(windowId)) {
      this.windowNodeToTab.set(windowId, new Map());
    }
    if (!this.windowTabToNode.has(windowId)) {
      this.windowTabToNode.set(windowId, new Map());
    }
    if (!this.lruOrder.has(windowId)) {
      this.lruOrder.set(windowId, []);
    }
  }

  /**
   * Register a tab for a node.
   * @param {number} windowId
   * @param {number} nodeId
   * @param {number} tabId
   */
  register(windowId, nodeId, tabId) {
    this._ensureWindow(windowId);
    
    const nodeToTab = this.windowNodeToTab.get(windowId);
    const tabToNode = this.windowTabToNode.get(windowId);
    
    // Remove old mappings if they exist
    const oldTabId = nodeToTab.get(nodeId);
    if (oldTabId !== undefined) {
      tabToNode.delete(oldTabId);
      this._removeFromLru(windowId, oldTabId);
    }
    
    const oldNodeId = tabToNode.get(tabId);
    if (oldNodeId !== undefined) {
      nodeToTab.delete(oldNodeId);
    }

    // Set new mappings
    nodeToTab.set(nodeId, tabId);
    tabToNode.set(tabId, nodeId);

    // Update LRU
    this.touch(windowId, tabId);
  }

  /**
   * Mark a tab as recently used (move to end of LRU).
   * @param {number} windowId
   * @param {number} tabId
   */
  touch(windowId, tabId) {
    this._ensureWindow(windowId);
    
    const order = this.lruOrder.get(windowId);
    const index = order.indexOf(tabId);
    if (index > -1) {
      order.splice(index, 1);
    }
    order.push(tabId);
  }

  /**
   * Remove a tab from LRU order.
   * @param {number} windowId
   * @param {number} tabId
   */
  _removeFromLru(windowId, tabId) {
    const order = this.lruOrder.get(windowId);
    if (order) {
      const index = order.indexOf(tabId);
      if (index > -1) {
        order.splice(index, 1);
      }
    }
  }

  /**
   * Get the tab ID for a node in a specific window.
   * @param {number} windowId
   * @param {number} nodeId
   * @returns {number|null} - null if not found
   */
  getTabForNode(windowId, nodeId) {
    const nodeToTab = this.windowNodeToTab.get(windowId);
    if (!nodeToTab) return null;
    const tabId = nodeToTab.get(nodeId);
    return tabId !== undefined ? tabId : null;
  }

  /**
   * Get the node ID for a tab in a specific window.
   * @param {number} windowId
   * @param {number} tabId
   * @returns {number|null} - null if not found
   */
  getNodeForTab(windowId, tabId) {
    const tabToNode = this.windowTabToNode.get(windowId);
    if (!tabToNode) return null;
    const nodeId = tabToNode.get(tabId);
    return nodeId !== undefined ? nodeId : null;
  }

  /**
   * Check if a node has an open tab in a specific window.
   * @param {number} windowId
   * @param {number} nodeId
   * @returns {boolean}
   */
  isNodeOpen(windowId, nodeId) {
    const nodeToTab = this.windowNodeToTab.get(windowId);
    return nodeToTab?.has(nodeId) || false;
  }

  /**
   * Get all open node IDs for a window.
   * @param {number} windowId
   * @returns {Set<number>}
   */
  getOpenNodesForWindow(windowId) {
    const nodeToTab = this.windowNodeToTab.get(windowId);
    if (!nodeToTab) return new Set();
    return new Set(nodeToTab.keys());
  }

  /**
   * Get the number of tabs in a window.
   * @param {number} windowId
   * @returns {number}
   */
  getTabCount(windowId) {
    const tabToNode = this.windowTabToNode.get(windowId);
    return tabToNode?.size || 0;
  }

  /**
   * Get the oldest (least recently used) tab ID in a window.
   * @param {number} windowId
   * @returns {number|null}
   */
  getOldestTab(windowId) {
    const order = this.lruOrder.get(windowId);
    return order?.[0] ?? null;
  }

  /**
   * Remove a tab from tracking (when tab is closed).
   * @param {number} windowId
   * @param {number} tabId
   */
  unregister(windowId, tabId) {
    const nodeToTab = this.windowNodeToTab.get(windowId);
    const tabToNode = this.windowTabToNode.get(windowId);
    
    if (tabToNode) {
      const nodeId = tabToNode.get(tabId);
      if (nodeId !== undefined && nodeToTab) {
        nodeToTab.delete(nodeId);
      }
      tabToNode.delete(tabId);
    }
    
    this._removeFromLru(windowId, tabId);
  }

  /**
   * Remove all tabs for a window (when window is closed).
   * @param {number} windowId
   */
  unregisterWindow(windowId) {
    this.windowNodeToTab.delete(windowId);
    this.windowTabToNode.delete(windowId);
    this.lruOrder.delete(windowId);
  }

  /**
   * Move a tab from one window to another (when tab is detached and attached).
   * @param {number} fromWindowId
   * @param {number} toWindowId
   * @param {number} tabId
   * @returns {number|null} - The nodeId that was moved, or null if not found
   */
  moveTab(fromWindowId, toWindowId, tabId) {
    const oldTabToNode = this.windowTabToNode.get(fromWindowId);
    if (!oldTabToNode) return null;
    
    const nodeId = oldTabToNode.get(tabId);
    if (nodeId === undefined) return null;
    
    // Unregister from old window
    this.unregister(fromWindowId, tabId);
    
    // Register in new window - note: nodeId may conflict in new window!
    // The caller should handle creating a new node in the new tree
    // For now, we just register with the same nodeId
    this.register(toWindowId, nodeId, tabId);
    
    return nodeId;
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
    if (oldestTabId === null) return null;

    try {
      await chrome.tabs.remove(oldestTabId);
      this.unregister(windowId, oldestTabId);
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
    const result = {
      windowNodeToTab: {},
      windowTabToNode: {},
      lruOrder: {}
    };
    
    for (const [windowId, map] of this.windowNodeToTab) {
      result.windowNodeToTab[windowId] = Object.fromEntries(map);
    }
    for (const [windowId, map] of this.windowTabToNode) {
      result.windowTabToNode[windowId] = Object.fromEntries(map);
    }
    for (const [windowId, arr] of this.lruOrder) {
      result.lruOrder[windowId] = arr;
    }
    
    return result;
  }
}

// Singleton instance
export const tabManager = new TabManager();
