import { NavigationTree } from './tree.js';

/**
 * Default extension settings.
 */
export const DEFAULT_SETTINGS = {
  maxCachedLinks: 10,   // Number of links to highlight
  stackCapacity: 100    // Maximum nodes per tab tree
};

/**
 * Storage manager for per-tab navigation trees and extension settings.
 * Uses chrome.storage.session for tab trees (ephemeral)
 * and chrome.storage.sync for settings (persistent, synced).
 */
export class StorageManager {
  constructor() {
    this.treeCache = new Map(); // In-memory cache for performance
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

  /**
   * Get all tab IDs that have trees.
   * @returns {Promise<number[]>}
   */
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
    const storedTabIds = await this.getAllTabIds();
    const existingTabs = await chrome.tabs.query({});
    const existingTabIds = new Set(existingTabs.map(t => t.id));

    for (const tabId of storedTabIds) {
      if (!existingTabIds.has(tabId)) {
        await this.removeTree(tabId);
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
