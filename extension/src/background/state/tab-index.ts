import type { NodeId, TabId } from "@shared/types/ids.js";

export class TabIndex {
    private tabToNode: Map<TabId, NodeId>;
    private nodeToTabs: Map<NodeId, Set<TabId>>;

    constructor() {
        this.tabToNode = new Map<TabId, NodeId>();
        this.nodeToTabs = new Map<NodeId, Set<TabId>>();
    }

    removeTabFromNode(nodeId: NodeId, tabId: TabId) {
        const tabs = this.nodeToTabs.get(nodeId);
      
        if (!tabs) {
          console.warn(`Node ${nodeId} has no tab set, but removing tab ${tabId}`);
          this.tabToNode.delete(tabId);
          return;
        }
      
        const existed = tabs.delete(tabId);
        if (!existed) {
          console.warn(`Tab ${tabId} was not present in node ${nodeId}`);
        }
      
        if (tabs.size === 0) this.nodeToTabs.delete(nodeId);
        this.tabToNode.delete(tabId);
      }
      

    nodeByTab(tabId: TabId): NodeId | undefined {
        return this.tabToNode.get(tabId);
    }

    addTabToNode(nodeId: NodeId, tabId: TabId) {
        this.tabToNode.set(tabId, nodeId);
        if (!this.nodeToTabs.has(nodeId)) {
            this.nodeToTabs.set(nodeId, new Set<TabId>());
        }
        this.nodeToTabs.get(nodeId)?.add(tabId);
    }

    tabsByNode(nodeId: NodeId): Set<TabId> {
        return this.nodeToTabs.get(nodeId) ?? new Set();
    }

    tabCountForNode(nodeId: NodeId): number {
        return this.nodeToTabs.get(nodeId)?.size ?? 0;
    }

    tabCount(): number {
        return this.tabToNode.size;
    }

    openNodes(): Set<NodeId> {
        return new Set(this.nodeToTabs.keys());
    }
}
