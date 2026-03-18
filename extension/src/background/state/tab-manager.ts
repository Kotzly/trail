import type { NodeId, TabId } from "@shared/types/ids.js";
import { NavigationTree } from "./nav-tree.js";
import { TabIndex } from "./tab-index.js";
import { LruManager } from "./tab-lru.js";
import { browser } from '@shared/platform/webext.js';

export class TabManager {
    private index: TabIndex;
    private lru: LruManager
    private cycleOrderByNode = new Map<NodeId, TabId[]>();
    private cycleIndexByNode = new Map<NodeId, number>();
    private suppressTouchForTabId: TabId | null = null;
    private suppressActivateForTabId = new Map<TabId, string | undefined>();
    private ignoredTabs = new Set<TabId>();

    constructor() {
        this.index = new TabIndex();
        this.lru = new LruManager();
    }

    reset() {
      this.index = new TabIndex();
      this.lru = new LruManager();
      this.cycleOrderByNode.clear();
      this.cycleIndexByNode.clear();
      this.suppressTouchForTabId = null;
      this.suppressActivateForTabId.clear();
      this.ignoredTabs.clear();
    }

    touch(tabId: TabId, _nodeId: NodeId, lastUsed?: number) {
        const actualNodeId = this.index.nodeByTab(tabId);
        if (!actualNodeId) return;
        this.lru.touch(tabId, actualNodeId, lastUsed);
        this.invalidateCycle(actualNodeId);
    }

    // Register a tab for a node (global across windows).
    // Reassigns the tab if it previously belonged to another node.
    register(nodeId: NodeId, tabId: TabId, options?: { touch?: boolean; lastUsed?: number }) {
      const previousNodeId = this.index.nodeByTab(tabId);
      
      if (previousNodeId) { // reassigning from previous node
        this.index.removeTabFromNode(previousNodeId, tabId);
        this.invalidateCycle(previousNodeId);
      }
      this.index.addTabToNode(nodeId, tabId);
      if (options?.touch === false) {
        this.lru.track(tabId, nodeId, options?.lastUsed);
      } else {
        this.lru.touch(tabId, nodeId, options?.lastUsed);
      }
      this.invalidateCycle(nodeId);
    }
  
    getNextTabForNode(nodeId: NodeId, currentTabId: TabId | null = null): TabId | null {
      const tabsSet = this.index.tabsByNode(nodeId);
      if (!tabsSet || tabsSet.size <= 1) return null;
      let order = this.cycleOrderByNode.get(nodeId);
      if (!this.isCycleOrderValid(order, tabsSet)) {
        order = this.getTabsByRecency(nodeId);
        this.cycleOrderByNode.set(nodeId, order);
      }

      if (currentTabId === null) {
        return order[0] ?? null;
      }

      let idx = this.cycleIndexByNode.get(nodeId);
      if (idx === undefined || order[idx] !== currentTabId) {
        idx = order.indexOf(currentTabId);
        if (idx === -1) idx = 0;
      }
      const nextIdx = (idx + 1) % order.length;
      this.cycleIndexByNode.set(nodeId, nextIdx);
      return order[nextIdx] ?? null;
    }
  
    // Get the node ID for a tab.
    nodeByTab(tabId: TabId): NodeId | undefined {
      return this.index.nodeByTab(tabId);
    }
  
    // Get all nodes that currently have at least one open tab.
    openNodes(): Set<NodeId> {
        return this.index.openNodes();
    }

    // Get tab count for a node.
    tabCountForNode(nodeId: NodeId): number {
        return this.index.tabCountForNode(nodeId);
    }

    // Get all tabs for a node.
    tabsByNode(nodeId: NodeId): Set<TabId> {
        return this.index.tabsByNode(nodeId);
    }
  
    // Unregister a tab (when it is closed).
    unregister(tabId: TabId) {
      const nodeId = this.index.nodeByTab(tabId);
      if (nodeId) {
        this.index.removeTabFromNode(nodeId, tabId);
        this.invalidateCycle(nodeId);
      }
  
      this.lru.remove(tabId);
      this.ignoredTabs.delete(tabId);
    }

    suppressNextTouch(tabId: TabId): void {
      this.suppressTouchForTabId = tabId;
    }

    shouldSuppressTouch(tabId: TabId): boolean {
      if (this.suppressTouchForTabId !== tabId) return false;
      this.suppressTouchForTabId = null;
      return true;
    }

    suppressNextActivate(tabId: TabId, sessionId?: string): void {
      this.suppressActivateForTabId.set(tabId, sessionId);
    }

    shouldSuppressActivate(tabId: TabId): boolean {
      if (!this.suppressActivateForTabId.has(tabId)) return false;
      this.suppressActivateForTabId.delete(tabId);
      return true;
    }

    clearSuppressActivate(tabId: TabId): void {
      this.suppressActivateForTabId.delete(tabId);
    }

    clearSuppressActivateBySession(sessionId: string): void {
      for (const [tabId, id] of this.suppressActivateForTabId.entries()) {
        if (id === sessionId) {
          this.suppressActivateForTabId.delete(tabId);
        }
      }
    }

    ignoreTabs(tabIds: Iterable<TabId>): void {
      for (const tabId of tabIds) {
        this.ignoredTabs.add(tabId);
      }
    }

    clearIgnoredTabs(tabIds?: Iterable<TabId>): void {
      if (!tabIds) {
        this.ignoredTabs.clear();
        return;
      }
      for (const tabId of tabIds) {
        this.ignoredTabs.delete(tabId);
      }
    }

    isIgnoredTab(tabId: TabId): boolean {
      return this.ignoredTabs.has(tabId);
    }

    getTabsByRecency(nodeId: NodeId): TabId[] {
      const tabsSet = this.index.tabsByNode(nodeId);
      if (!tabsSet) return [];
      return [...tabsSet].sort((a, b) => this.lru.getLastUsed(b) - this.lru.getLastUsed(a));
    }

    getNodeRecency(nodeId: NodeId): number {
      const tabsSet = this.index.tabsByNode(nodeId);
      if (!tabsSet || tabsSet.size === 0) return 0;
      let max = 0;
      for (const tabId of tabsSet) {
        max = Math.max(max, this.lru.getLastUsed(tabId));
      }
      return max;
    }

    private isCycleOrderValid(order: TabId[] | undefined, tabsSet: Set<TabId>): order is TabId[] {
      if (!order || order.length !== tabsSet.size) return false;
      for (const tabId of order) {
        if (!tabsSet.has(tabId)) return false;
      }
      return true;
    }

    private invalidateCycle(nodeId: NodeId): void {
      this.cycleOrderByNode.delete(nodeId);
      this.cycleIndexByNode.delete(nodeId);
    }
  
    // Close oldest tab globally if the limit is exceeded (skips pinned nodes).
    async closeOldest(
      limit: number,
      tree: NavigationTree | null = null,
      options?: { activeTabIds?: Set<TabId>; skipLoading?: boolean }
    ): Promise<TabId | null> {
      if (limit === 0) return null; // Unlimited

      const count = this.index.tabCount();
      if (count <= limit) return null;
      let tabIdToClose = null;
      const candidates = [...this.lru.iter()].sort(
        (a, b) => this.lru.getLastUsed(a) - this.lru.getLastUsed(b),
      );
      for (const tabId of candidates) {
        const nodeId = this.index.nodeByTab(tabId);
        if (!nodeId) {
            console.warn('[tab-manager] Orphaned LRU entry, removing tab:', tabId);
            this.lru.remove(tabId); // self-removal
            continue;
        }
        if (tree) {
          const node = tree.findNodeById(nodeId);
          if (node?.data.pinned) continue; // Skip pinned nodes
        }
        if (options?.activeTabIds && options.activeTabIds.has(tabId)) continue;
        if (options?.skipLoading) {
          try {
            const tab = await browser.tabs.get(tabId);
            if (tab.status === 'loading') continue;
          } catch {
            this.unregister(tabId);
            continue;
          }
        }
        tabIdToClose = tabId;
        break;
      }

      if (!tabIdToClose) return null; // All tabs are pinned

      try {
        await browser.tabs.remove(tabIdToClose);
        this.unregister(tabIdToClose);
        return tabIdToClose;
      } catch {
        return null;
      }
    }

    async closeOldestUntil(
      limit: number,
      tree: NavigationTree | null = null,
      options?: { activeTabIds?: Set<TabId>; skipLoading?: boolean }
    ): Promise<number> {
      let closed = 0;
      while (true) {
        const closedTabId = await this.closeOldest(limit, tree, options);
        if (!closedTabId) break;
        closed += 1;
      }
      return closed;
    }
  
    dumpDebug() {
        return {
          tabToNode: Object.fromEntries(this.index["tabToNode"]?.entries?.() ?? []),
          nodeToTabs: Object.fromEntries(
            [...(this.index["nodeToTabs"]?.entries?.() ?? [])].map(([k, v]) => [k, [...v]])
          ),
          lruOrder: [...this.lru.iter()],
          lastUsed: Object.fromEntries(this.lru["lastUsed"]?.entries?.() ?? []),
          latestTabId: this.lru.getLatestTabId(),
          latestNodeId: this.lru.getLatestNodeId(),
        };
      }
  }

export const tabManager = new TabManager();
