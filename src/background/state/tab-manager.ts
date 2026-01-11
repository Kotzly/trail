import type { NodeId, TabId } from "../../shared/types/ids.js";
import { NavigationTree } from "./nav-tree.js";
import { TabIndex } from "./tab-index.js";
import { LruManager } from "./tab-lru.js";

export class TabManager {
    private index: TabIndex;
    private lru: LruManager
    private cycleOrderByNode = new Map<NodeId, TabId[]>();
    private cycleIndexByNode = new Map<NodeId, number>();
    private suppressTouchForTabId: TabId | null = null;

    constructor() {
        this.index = new TabIndex();
        this.lru = new LruManager();
    }

    touch(tabId: TabId, _nodeId: NodeId) {
        const actualNodeId = this.index.nodeByTab(tabId);
        if (!actualNodeId) return;
        this.lru.touch(tabId, actualNodeId);
        this.invalidateCycle(actualNodeId);
    }

    // Register a tab for a node (global across windows).
    // Reassigns the tab if it previously belonged to another node.
    register(nodeId: NodeId, tabId: TabId) {
      const previousNodeId = this.index.nodeByTab(tabId);
      
      if (previousNodeId) { // reassigning from previous node
        this.index.removeTabFromNode(previousNodeId, tabId);
        this.invalidateCycle(previousNodeId);
      }
      this.index.addTabToNode(nodeId, tabId);
      this.lru.touch(tabId, nodeId);
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
    }

    suppressNextTouch(tabId: TabId): void {
      this.suppressTouchForTabId = tabId;
    }

    shouldSuppressTouch(tabId: TabId): boolean {
      if (this.suppressTouchForTabId !== tabId) return false;
      this.suppressTouchForTabId = null;
      return true;
    }

    getTabsByRecency(nodeId: NodeId): TabId[] {
      const tabsSet = this.index.tabsByNode(nodeId);
      if (!tabsSet) return [];
      return [...tabsSet].sort((a, b) => this.lru.getLastUsed(b) - this.lru.getLastUsed(a));
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
    async closeOldest(limit: number, tree: NavigationTree | null = null): Promise<TabId | null> {
      if (limit === 0) return null; // Unlimited

      const count = this.index.tabCount();
      if (count <= limit) return null;
      let tabIdToClose = null;
      for (const tabId of this.lru.iter()) {
        const nodeId = this.index.nodeByTab(tabId);
        if (!nodeId) {
            this.lru.remove(tabId); // self-remova
            continue;
        }
        if (tree) {
          const node = tree.findNodeById(nodeId);
          if (node?.data.pinned) continue; // Skip pinned nodes
        }
        tabIdToClose = tabId;
        break;
      }

      if (!tabIdToClose) return null; // All tabs are pinned

      try {
        await chrome.tabs.remove(tabIdToClose);
        this.unregister(tabIdToClose);
        return tabIdToClose;
      } catch (error) {
        console.debug('Failed to close oldest tab:', error);
        return null;
      }
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
