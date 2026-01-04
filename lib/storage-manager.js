import { NavigationTree } from './tree.js';
import { DEFAULT_VIEW_MODE } from './view-modes.js';

/**
 * Theme options.
 */
export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

/**
 * Default extension settings.
 */
export const DEFAULT_SETTINGS = {
  maxCachedLinks: 10,   // Number of links to highlight
  stackCapacity: 100,   // Maximum nodes per tree
  viewMode: DEFAULT_VIEW_MODE, // Display mode: 'tree', 'stack', or 'graph'
  theme: THEME.SYSTEM,  // Theme: 'light', 'dark', or 'system'
  multiTabEnabled: false, // Multi-tab mode: each page in separate tab (global default)
  multiTabLimit: 0,     // Max tabs in multi-tab mode (0 = unlimited)
  forestMode: true,     // Forest mode: each new tab creates a new tree (true) or branches from current (false)
  backOnRevisit: true,  // Navigate back to ancestor when revisiting same URL
  compactGraph: false,  // Compact graph mode: smaller nodes with just favicon + domain
  selectionMenuInstant: false, // Show selection menu immediately after selection (vs on RMB)
  // Feature flags (A/B)
  enableSearch: true,   // Enable search functionality
  enablePinNodes: true, // Enable pin/lock nodes
  enableTags: true      // Enable tags/labels
};

/**
 * Storage manager for navigation trees and extension settings.
 * Supports both per-tab (single-tab mode) and per-window (multi-tab mode) trees.
 * Uses chrome.storage.session for trees (ephemeral)
 * and chrome.storage.sync for settings (persistent, synced).
 */
export class StorageManager {
  constructor() {
    this.treeCache = new Map(); // In-memory cache for performance
    this.windowTreeCache = new Map(); // Cache for per-window trees (multi-tab mode)
    this.globalTreeCache = null; // Cache for global tree (multi-tab mode, shared across windows)
    this.windowOverrides = new Map(); // Per-window multi-tab overrides (in memory)
  }

  /**
   * Get the storage key for a tab's tree.
   * @param {number} tabId
   * @returns {string}
   */
  getTreeKey(tabId) {
    return `tree_${tabId}`;
  }

  /**
   * Get the storage key for a window's tree (multi-tab mode).
   * @param {number} windowId
   * @returns {string}
   */
  getWindowTreeKey(windowId) {
    return `wtree_${windowId}`;
  }

  /**
   * Load settings from storage.
   * @returns {Promise<typeof DEFAULT_SETTINGS>}
   */
  async getSettings() {
    const result = await chrome.storage.sync.get('settings');
    return { ...DEFAULT_SETTINGS, ...result.settings };
  }

  /**
   * Save settings to storage.
   * @param {Partial<typeof DEFAULT_SETTINGS>} settings
   */
  async saveSettings(settings) {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await chrome.storage.sync.set({ settings: updated });
    return updated;
  }

  // ============================================
  // Per-Window Multi-Tab Overrides
  // ============================================

  /**
   * Check if multi-tab is enabled for a specific window.
   * Returns the per-window override if set, otherwise the global setting.
   * @param {number} windowId
   * @returns {Promise<boolean>}
   */
  async isMultiTabEnabledForWindow(windowId) {
    // Check for per-window override first
    if (this.windowOverrides.has(windowId)) {
      return this.windowOverrides.get(windowId);
    }
    // Fall back to global setting
    const settings = await this.getSettings();
    return settings.multiTabEnabled;
  }

  /**
   * Set per-window multi-tab override.
   * @param {number} windowId
   * @param {boolean} enabled
   */
  setWindowMultiTabOverride(windowId, enabled) {
    this.windowOverrides.set(windowId, enabled);
  }

  /**
   * Get per-window multi-tab override (or null if not set).
   * @param {number} windowId
   * @returns {boolean|null}
   */
  getWindowMultiTabOverride(windowId) {
    if (this.windowOverrides.has(windowId)) {
      return this.windowOverrides.get(windowId);
    }
    return null;
  }

  /**
   * Clear per-window override (revert to global).
   * @param {number} windowId
   */
  clearWindowMultiTabOverride(windowId) {
    this.windowOverrides.delete(windowId);
  }

  /**
   * Get tree for a specific tab.
   * @param {number} tabId
   * @returns {Promise<NavigationTree>}
   */
  async getTree(tabId) {
    // Check in-memory cache first
    if (this.treeCache.has(tabId)) {
      return this.treeCache.get(tabId);
    }

    const key = this.getTreeKey(tabId);
    const result = await chrome.storage.session.get(key);
    const settings = await this.getSettings();

    let tree;
    if (result[key]) {
      tree = NavigationTree.fromJSON(result[key]);
      tree.setCapacity(settings.stackCapacity);
    } else {
      tree = new NavigationTree(settings.stackCapacity);
    }

    this.treeCache.set(tabId, tree);
    return tree;
  }

  /**
   * Save tree for a specific tab.
   * @param {number} tabId
   * @param {NavigationTree} tree
   */
  async saveTree(tabId, tree) {
    const key = this.getTreeKey(tabId);
    this.treeCache.set(tabId, tree);
    await chrome.storage.session.set({ [key]: tree.toJSON() });
  }

  /**
   * Remove tree for a specific tab (cleanup on tab close).
   * @param {number} tabId
   */
  async removeTree(tabId) {
    const key = this.getTreeKey(tabId);
    this.treeCache.delete(tabId);
    await chrome.storage.session.remove(key);
  }

  // ============================================
  // Global Tree Methods (Single Graph Across All Windows)
  // ============================================

  /**
   * Get the global tree (shared across all windows).
   * @returns {Promise<NavigationTree>}
   */
  async getGlobalTree() {
    const key = 'wtree_global';

    // Check in-memory cache first
    if (this.globalTreeCache) {
      return this.globalTreeCache;
    }

    const result = await chrome.storage.session.get(key);
    const settings = await this.getSettings();

    let tree;
    if (result[key]) {
      tree = NavigationTree.fromJSON(result[key]);
      tree.setCapacity(settings.stackCapacity);
    } else {
      tree = new NavigationTree(settings.stackCapacity);
    }

    this.globalTreeCache = tree;
    return tree;
  }

  /**
   * Save the global tree.
   * @param {NavigationTree} tree
   */
  async saveGlobalTree(tree) {
    const key = 'wtree_global';
    this.globalTreeCache = tree;
    await chrome.storage.session.set({ [key]: tree.toJSON() });
  }

  // ============================================
  // Per-Window Tree Methods (Legacy - kept for compatibility)
  // ============================================

  /**
   * Get tree for a specific window (multi-tab mode).
   * @param {number} windowId
   * @returns {Promise<NavigationTree>}
   */
  async getWindowTree(windowId) {
    // Check in-memory cache first
    if (this.windowTreeCache.has(windowId)) {
      return this.windowTreeCache.get(windowId);
    }

    const key = this.getWindowTreeKey(windowId);
    const result = await chrome.storage.session.get(key);
    const settings = await this.getSettings();

    let tree;
    if (result[key]) {
      tree = NavigationTree.fromJSON(result[key]);
      tree.setCapacity(settings.stackCapacity);
    } else {
      tree = new NavigationTree(settings.stackCapacity);
    }

    this.windowTreeCache.set(windowId, tree);
    return tree;
  }

  /**
   * Save tree for a specific window (multi-tab mode).
   * @param {number} windowId
   * @param {NavigationTree} tree
   */
  async saveWindowTree(windowId, tree) {
    const key = this.getWindowTreeKey(windowId);
    this.windowTreeCache.set(windowId, tree);
    await chrome.storage.session.set({ [key]: tree.toJSON() });
  }

  /**
   * Remove tree for a specific window (cleanup on window close).
   * @param {number} windowId
   */
  async removeWindowTree(windowId) {
    const key = this.getWindowTreeKey(windowId);
    this.windowTreeCache.delete(windowId);
    await chrome.storage.session.remove(key);
  }

  /**
   * Get all window IDs that have trees.
   * @returns {Promise<number[]>}
   */
  async getAllWindowIds() {
    const all = await chrome.storage.session.get(null);
    return Object.keys(all)
      .filter(key => key.startsWith('wtree_'))
      .map(key => parseInt(key.replace('wtree_', ''), 10));
  }

  // ============================================
  // Tab IDs and Cleanup
  // ============================================
  async getAllTabIds() {
    const all = await chrome.storage.session.get(null);
    return Object.keys(all)
      .filter(key => key.startsWith('tree_'))
      .map(key => parseInt(key.replace('tree_', ''), 10));
  }

  /**
   * Cleanup trees for tabs that no longer exist.
   */
  async cleanupOrphanedTrees() {
    // Cleanup tab trees
    const storedTabIds = await this.getAllTabIds();
    const existingTabs = await chrome.tabs.query({});
    const existingTabIds = new Set(existingTabs.map(t => t.id));

    for (const tabId of storedTabIds) {
      if (!existingTabIds.has(tabId)) {
        await this.removeTree(tabId);
      }
    }

    // Cleanup window trees
    const storedWindowIds = await this.getAllWindowIds();
    const existingWindows = await chrome.windows.getAll();
    const existingWindowIds = new Set(existingWindows.map(w => w.id));

    for (const windowId of storedWindowIds) {
      if (!existingWindowIds.has(windowId)) {
        await this.removeWindowTree(windowId);
      }
    }
  }

  /**
   * Clear in-memory cache (useful when service worker restarts).
   */
  clearCache() {
    this.treeCache.clear();
  }
}

// Singleton instance
export const storageManager = new StorageManager();
