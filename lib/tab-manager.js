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
    // Per-window nodeId -> tabId mapping (legacy)
    // Map<windowId, Map<nodeId, tabId>>
    this.windowNodeToTab = new Map();

    // Per-window tabId -> nodeId mapping (legacy)
    // Map<windowId, Map<tabId, nodeId>>
    this.windowTabToNode = new Map();

    // LRU order per window: windowId -> array of tabIds (most recent at end)
    this.lruOrder = new Map();

    // ========== GLOBAL MODE MAPPINGS ==========
    // nodeId -> {windowId, tabId} - primary tab for each node (for backward compatibility)
    this.globalNodeToTab = new Map();

    // nodeId -> [{windowId, tabId}, ...] - all tabs for each node in same window
    // Key format: `${nodeId}_${windowId}` -> array of {windowId, tabId}
    this.globalNodeTabsInWindow = new Map();

    // tabId -> nodeId - reverse lookup
    this.globalTabToNode = new Map();

    // Global LRU order: array of tabIds (most recent at end)
    this.globalLruOrder = [];
  }

  // ============================================
  // Global Mode Methods (Single Graph Across All Windows)
  // ============================================

  /**
   * Register a tab for a node globally.
   * Supports multiple tabs per node in the same window.
   * @param {number} nodeId
   * @param {number} windowId
   * @param {number} tabId
   */
  registerGlobal(nodeId, windowId, tabId) {
    // Remove old mappings if they exist
    const oldEntry = this.globalNodeToTab.get(nodeId);
    if (oldEntry) {
      this.globalTabToNode.delete(oldEntry.tabId);
      this._removeFromGlobalLru(oldEntry.tabId);
    }

    const oldNodeId = this.globalTabToNode.get(tabId);
    if (oldNodeId !== undefined) {
      // Remove from old node's tab list
      this._removeTabFromNodeGlobal(oldNodeId, windowId, tabId);
      // Update primary mapping if this was the primary tab
      const oldPrimary = this.globalNodeToTab.get(oldNodeId);
      if (oldPrimary && oldPrimary.tabId === tabId) {
        this.globalNodeToTab.delete(oldNodeId);
      }
    }

    // Set primary mapping (first tab or most recent)
    this.globalNodeToTab.set(nodeId, { windowId, tabId });
    this.globalTabToNode.set(tabId, nodeId);

    // Add to node's tab list in this window
    this._addTabToNodeGlobal(nodeId, windowId, tabId);

    // Update LRU
    this.touchGlobal(tabId);
  }

  /**
   * Add a tab to a node's tab list in a specific window.
   * @private
   */
  _addTabToNodeGlobal(nodeId, windowId, tabId) {
    const key = `${nodeId}_${windowId}`;
    if (!this.globalNodeTabsInWindow.has(key)) {
      this.globalNodeTabsInWindow.set(key, []);
    }
    const tabs = this.globalNodeTabsInWindow.get(key);
    // Don't add duplicates
    if (!tabs.find(t => t.tabId === tabId)) {
      tabs.push({ windowId, tabId });
    }
  }

  /**
   * Remove a tab from a node's tab list in a specific window.
   * @private
   */
  _removeTabFromNodeGlobal(nodeId, windowId, tabId) {
    const key = `${nodeId}_${windowId}`;
    const tabs = this.globalNodeTabsInWindow.get(key);
    if (tabs) {
      const index = tabs.findIndex(t => t.tabId === tabId);
      if (index > -1) {
        tabs.splice(index, 1);
        if (tabs.length === 0) {
          this.globalNodeTabsInWindow.delete(key);
        }
      }
    }
  }

  /**
   * Get all tabs for a node in a specific window.
   * @param {number} nodeId
   * @param {number} windowId
   * @returns {Array<{windowId: number, tabId: number}>}
   */
  getTabsForNodeInWindow(nodeId, windowId) {
    const key = `${nodeId}_${windowId}`;
    return this.globalNodeTabsInWindow.get(key) || [];
  }

  /**
   * Get tab count for a node in a specific window.
   * @param {number} nodeId
   * @param {number} windowId
   * @returns {number}
   */
  getTabCountForNodeInWindow(nodeId, windowId) {
    return this.getTabsForNodeInWindow(nodeId, windowId).length;
  }

  /**
   * Cycle to next tab for a node in a window.
   * Returns the next tab to focus, or null if only one tab.
   * @param {number} nodeId
   * @param {number} windowId
   * @param {number} currentTabId - Currently active tab (optional)
   * @returns {{windowId: number, tabId: number}|null}
   */
  getNextTabForNodeInWindow(nodeId, windowId, currentTabId = null) {
    const tabs = this.getTabsForNodeInWindow(nodeId, windowId);
    if (tabs.length <= 1) return null;

    if (currentTabId === null) {
      // No current tab specified - return first tab
      return tabs[0];
    }

    // Find current tab index
    const currentIndex = tabs.findIndex(t => t.tabId === currentTabId);
    if (currentIndex === -1) {
      // Current tab not found - return first tab
      return tabs[0];
    }

    // Return next tab (cycle to beginning if at end)
    const nextIndex = (currentIndex + 1) % tabs.length;
    return tabs[nextIndex];
  }

  /**
   * Mark a tab as recently used in global LRU.
   * @param {number} tabId
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
   * @param {number} tabId
   */
  _removeFromGlobalLru(tabId) {
    const index = this.globalLruOrder.indexOf(tabId);
    if (index > -1) {
      this.globalLruOrder.splice(index, 1);
    }
  }

  /**
   * Get the window and tab for a node (global mode).
   * @param {number} nodeId
   * @returns {{windowId: number, tabId: number}|null}
   */
  getTabForNodeGlobal(nodeId) {
    return this.globalNodeToTab.get(nodeId) || null;
  }

  /**
   * Get the node ID for a tab (global mode).
   * @param {number} tabId
   * @returns {number|null}
   */
  getNodeForTabGlobal(tabId) {
    const nodeId = this.globalTabToNode.get(tabId);
    return nodeId !== undefined ? nodeId : null;
  }

  /**
   * Get all open node IDs across all windows (global mode).
   * @returns {Set<number>}
   */
  getAllOpenNodes() {
    return new Set(this.globalNodeToTab.keys());
  }

  /**
   * Unregister a tab (global mode).
   * @param {number} tabId
   */
  unregisterGlobal(tabId) {
    const nodeId = this.globalTabToNode.get(tabId);
    if (nodeId !== undefined) {
      // Get windowId from primary mapping or find it
      const primary = this.globalNodeToTab.get(nodeId);
      const windowId = primary?.windowId;
      
      if (windowId) {
        this._removeTabFromNodeGlobal(nodeId, windowId, tabId);
        
        // If this was the primary tab, update primary to another tab in same window
        if (primary && primary.tabId === tabId) {
          const remainingTabs = this.getTabsForNodeInWindow(nodeId, windowId);
          if (remainingTabs.length > 0) {
            // Use first remaining tab as new primary
            this.globalNodeToTab.set(nodeId, remainingTabs[0]);
          } else {
            // No more tabs for this node
            this.globalNodeToTab.delete(nodeId);
          }
        }
      }
    }
    this.globalTabToNode.delete(tabId);
    this._removeFromGlobalLru(tabId);
  }

  /**
   * Update window ID for a tab (when tab is moved between windows).
   * @param {number} tabId
   * @param {number} newWindowId
   */
  updateTabWindow(tabId, newWindowId) {
    const nodeId = this.globalTabToNode.get(tabId);
    if (nodeId !== undefined) {
      this.globalNodeToTab.set(nodeId, { windowId: newWindowId, tabId });
    }
  }

  /**
   * Close oldest tab globally if limit exceeded.
   * Skips pinned nodes.
   * @param {number} limit - Maximum tabs allowed (0 = unlimited)
   * @param {object} tree - NavigationTree to check pinned status
   * @returns {Promise<number|null>} - The closed tab ID or null
   */
  async closeOldestGlobalIfNeeded(limit, tree = null) {
    if (limit === 0) return null; // Unlimited

    const count = this.globalNodeToTab.size;
    if (count <= limit) return null;

    // Find oldest non-pinned tab
    let tabIdToClose = null;
    for (const tabId of this.globalLruOrder) {
      const nodeId = this.globalTabToNode.get(tabId);
      if (nodeId !== undefined && tree) {
        const node = tree.findById(nodeId);
        if (node && node.pinned) {
          continue; // Skip pinned nodes
        }
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

  // ============================================
  // Per-Window Methods (Legacy - kept for compatibility)
  // ============================================

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
