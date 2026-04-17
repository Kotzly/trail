import type { NodeId, TabId } from "@shared/types/ids.js";
import { createLogger } from "@shared/lib/logger.js";

const log = createLogger("tab-index");

/**
 * Shared frozen empty Set returned by tabsByNode() when a node has no
 * registered tabs. Mutating the returned Set is never allowed — callers
 * that want to change node↔tab membership must go through addTabToNode /
 * removeTabFromNode. Using a singleton avoids allocating a throwaway
 * Set on every miss and removes the API smell where a returned empty
 * Set could be mistaken for "the live set, just empty" (#48).
 */
const EMPTY_TAB_SET: ReadonlySet<TabId> = Object.freeze(new Set<TabId>());

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
      log.warn("Node has no tab set, but removing tab", { nodeId, tabId: String(tabId) });
      this.tabToNode.delete(tabId);
      return;
    }

    const existed = tabs.delete(tabId);
    if (!existed) {
      log.warn("Tab was not present in node", { tabId: String(tabId), nodeId });
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

  /**
   * Returns the live Set of tabs for a node, or a shared frozen
   * empty Set singleton if the node is unknown. Callers must never
   * mutate the returned Set directly — use addTabToNode /
   * removeTabFromNode.
   */
  tabsByNode(nodeId: NodeId): Set<TabId> {
    return (this.nodeToTabs.get(nodeId) ?? EMPTY_TAB_SET) as Set<TabId>;
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
