import type { NodeId, TabId } from "../../shared/types/ids";
import { NavigationTree } from "./tree-store";
import { TabIndex } from "./tab-index";
import { LruManager } from "./tab-lru";

export class TabManager {
    private index: TabIndex;
    private lru: LruManager

    constructor() {
        this.index = new TabIndex();
        this.lru = new LruManager();
    }

    touch(tabId: TabId) {
        if (!this.index.nodeByTab(tabId)) return;
        this.lru.touch(tabId);
    }

    // Register a tab for a node (global across windows).
    // Reassigns the tab if it previously belonged to another node.
    register(nodeId: NodeId, tabId: TabId) {
      const previousNodeId = this.index.nodeByTab(tabId);
      
      if (previousNodeId) { // reassigning from previous node
        this.index.removeTabFromNode(previousNodeId, tabId);
      }
      this.index.addTabToNode(nodeId, tabId);
      this.lru.touch(tabId);
    }
  
    getNextTabForNode(nodeId: NodeId, currentTabId: TabId | null = null): TabId | null {
      const tabsSet = this.index.tabsByNode(nodeId);
      if (!tabsSet || tabsSet.size <= 1) return null;

      const tabs = [...tabsSet].sort((a, b) => this.lru.getLastUsed(b) - this.lru.getLastUsed(a));
      // tabs[0] is the most recently used tab

      if (currentTabId === null) {
        return tabs[0] ?? null;
      }

      const idx = tabs.indexOf(currentTabId);
      if (idx === -1) return tabs[0] ?? null;
      const nextIdx = (idx + 1) % tabs.length;
      return tabs[nextIdx] ?? null;
    }
  
    // Get the node ID for a tab.
    getNodeForTabGlobal(tabId: TabId): NodeId | undefined {
      return this.index.nodeByTab(tabId);
    }
  
    // Get all nodes that currently have at least one open tab.
    openNodes(): Set<NodeId> {
        return this.index.openNodes();
    }
  
    // Unregister a tab (when it is closed).
    unregister(tabId: TabId) {
      const nodeId = this.index.nodeByTab(tabId);
      if (nodeId) {
        this.index.removeTabFromNode(nodeId, tabId);
      }
  
      this.lru.remove(tabId);
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
          const node = tree.findById(nodeId);
          if (node?.pinned) continue; // Skip pinned nodes
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
          latest: this.lru.latest
        };
      }
  }

export const tabManager = new TabManager();
