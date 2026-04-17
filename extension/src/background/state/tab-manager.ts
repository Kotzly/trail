import type { NodeId, TabId } from "@shared/types/ids.js";
import { type NavigationTree } from "./nav-tree.js";
import { TabIndex } from "./tab-index.js";
import { LruManager } from "./tab-lru.js";
import { browser } from "@shared/platform/webext.js";
import { createLogger } from "@shared/lib/logger.js";
import { storage } from "wxt/utils/storage";

const log = createLogger("tab-manager");

/**
 * Persisted in chrome.storage.session so the map survives MV3
 * service-worker suspend (session storage lives for the browser
 * session, not just the SW lifetime). Key: `${TabId}`. Value: NodeId.
 */
const lastNodeByTabItem = storage.defineItem<Record<string, string>>(
  "session:trail_last_node_by_tab",
  { fallback: {} },
);

export class TabManager {
  private index: TabIndex;
  private lru: LruManager;
  private cycleOrderByNode = new Map<NodeId, TabId[]>();
  private cycleIndexByNode = new Map<NodeId, number>();
  private suppressTouchForTabId = new Map<TabId, boolean>();
  private suppressActivateForTabId = new Map<TabId, string | undefined>();
  private ignoredTabs = new Set<TabId>();
  /**
   * Optional tree accessor injected at service-worker init. When set,
   * register() validates that the nodeId exists in the current tree
   * before recording the mapping, preventing "phantom" node entries
   * from stale RPC handlers (#70).
   */
  private treeAccessor: (() => NavigationTree | null) | null = null;

  /**
   * Per-tab "last known node" used as a fallback parent signal for
   * opener-based navigation attribution (Phase 2). When a new tab is
   * spawned from tab A, we want the new tab's first navigation to
   * attach under A's node — even if A has already been re-registered
   * elsewhere since the click.
   *
   * Persisted to chrome.storage.session so SW suspend + resume doesn't
   * regress parent inference (critic C3).
   */
  private lastNodeByTab = new Map<TabId, NodeId>();
  private hydrated = false;

  constructor() {
    this.index = new TabIndex();
    this.lru = new LruManager();
    // Let the LRU derive latestNodeId on demand from the index.
    this.lru.setNodeResolver((tabId) => this.index.nodeByTab(tabId));
  }

  /**
   * Inject the tree accessor. Called from service-worker bootstrap
   * so register() can validate nodeIds against the live tree.
   */
  setTreeAccessor(accessor: () => NavigationTree | null): void {
    this.treeAccessor = accessor;
  }

  /**
   * Drop all tab mappings that reference any of the given node ids.
   * Called from NavigationTree delete paths so tabs pinned to a
   * deleted node are released instead of silently pointing at a
   * zombie id (#22, #29).
   */
  onNodesDeleted(nodeIds: Iterable<NodeId>): void {
    for (const nodeId of nodeIds) {
      const tabs = this.index.tabsByNode(nodeId);
      if (!tabs || tabs.size === 0) continue;
      for (const tabId of [...tabs]) this.unregister(tabId);
    }
  }

  /** Load persisted `lastNodeByTab` mapping from session storage. */
  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    try {
      const raw = await lastNodeByTabItem.getValue();
      for (const [tabKey, nodeId] of Object.entries(raw)) {
        const tabId = Number(tabKey);
        if (!Number.isFinite(tabId) || typeof nodeId !== "string") continue;
        this.lastNodeByTab.set(tabId as TabId, nodeId as NodeId);
      }
    } catch (error) {
      log.warn("Failed to hydrate lastNodeByTab", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    this.hydrated = true;
  }

  /** Synchronous read; returns undefined if the tab has no known last node. */
  lastNodeByTabId(tabId: TabId): NodeId | undefined {
    return this.lastNodeByTab.get(tabId);
  }

  private persistLastNodeByTab(): void {
    const snapshot: Record<string, string> = {};
    for (const [tabId, nodeId] of this.lastNodeByTab.entries()) {
      snapshot[String(tabId)] = nodeId as string;
    }
    // Fire-and-forget — session storage writes are cheap.
    void lastNodeByTabItem.setValue(snapshot).catch((error) => {
      log.warn("Failed to persist lastNodeByTab", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  reset() {
    this.index = new TabIndex();
    this.lru = new LruManager();
    this.lru.setNodeResolver((tabId) => this.index.nodeByTab(tabId));
    this.cycleOrderByNode.clear();
    this.cycleIndexByNode.clear();
    this.suppressTouchForTabId.clear();
    this.suppressActivateForTabId.clear();
    this.ignoredTabs.clear();
    this.lastNodeByTab.clear();
    this.persistLastNodeByTab();
  }

  touch(tabId: TabId, nodeId: NodeId, lastUsed?: number) {
    const actualNodeId = this.index.nodeByTab(tabId);
    if (!actualNodeId) return;
    if (actualNodeId !== nodeId) {
      // Caller's nodeId doesn't match the current mapping. Don't
      // silently redirect — log so the divergence shows up in
      // observability (#71). Still touch the real mapping so LRU
      // reflects reality.
      log.warn("touch nodeId mismatch — using index value", {
        tabId: String(tabId),
        requested: String(nodeId),
        actual: String(actualNodeId),
      });
    }
    this.lru.touch(tabId, actualNodeId, lastUsed);
    this.invalidateCycle(actualNodeId);
  }

  // Register a tab for a node (global across windows).
  // Reassigns the tab if it previously belonged to another node.
  register(nodeId: NodeId, tabId: TabId, options?: { touch?: boolean; lastUsed?: number }) {
    // Validate the nodeId exists in the tree (#70). Without this,
    // stale RPC handlers or in-flight navigations can pin tabs to
    // deleted nodes, polluting openNodes() and tabsByNode().
    if (this.treeAccessor) {
      const tree = this.treeAccessor();
      if (tree && !tree.findNodeById(nodeId)) {
        log.warn("register rejected — nodeId not in tree", {
          nodeId: String(nodeId),
          tabId: String(tabId),
        });
        return;
      }
    }

    const previousNodeId = this.index.nodeByTab(tabId);

    if (previousNodeId) {
      // reassigning from previous node
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
    // Remember the last known node for this tab (opener fallback).
    this.lastNodeByTab.set(tabId, nodeId);
    this.persistLastNodeByTab();
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
    if (this.lastNodeByTab.delete(tabId)) {
      this.persistLastNodeByTab();
    }
  }

  suppressNextTouch(tabId: TabId): void {
    // Per-tab Map so two rapid suppressions on different tabs don't
    // overwrite each other (#51).
    this.suppressTouchForTabId.set(tabId, true);
  }

  shouldSuppressTouch(tabId: TabId): boolean {
    if (!this.suppressTouchForTabId.has(tabId)) return false;
    this.suppressTouchForTabId.delete(tabId);
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
    return [...tabsSet].sort((a, b) => {
      const ta = this.lru.getLastUsed(b) ?? -Infinity;
      const tb = this.lru.getLastUsed(a) ?? -Infinity;
      return ta - tb;
    });
  }

  getNodeRecency(nodeId: NodeId): number {
    const tabsSet = this.index.tabsByNode(nodeId);
    if (!tabsSet || tabsSet.size === 0) return 0;
    let max = 0;
    for (const tabId of tabsSet) {
      const ts = this.lru.getLastUsed(tabId);
      if (ts !== undefined && ts > max) max = ts;
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
    options?: { activeTabIds?: Set<TabId>; skipLoading?: boolean },
  ): Promise<TabId | null> {
    if (limit === 0) return null; // Unlimited

    const count = this.index.tabCount();
    if (count <= limit) return null;
    let tabIdToClose = null;
    // Deterministic tie-break: (lastUsed ?? -1, tabId). Fresh-profile
    // cases where many tabs report lastAccessed=0 used to be arbitrary;
    // now tied tabs sort by tabId so close-order is stable.
    const candidates = [...this.lru.iter()].sort((a, b) => {
      const ta = this.lru.getLastUsed(a) ?? -1;
      const tb = this.lru.getLastUsed(b) ?? -1;
      if (ta !== tb) return ta - tb;
      return (a as number) - (b as number);
    });
    for (const tabId of candidates) {
      const nodeId = this.index.nodeByTab(tabId);
      if (!nodeId) {
        log.warn("Orphaned LRU entry, removing tab", { tabId: String(tabId) });
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
          if (tab.status === "loading") continue;
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
    } catch (error) {
      // Chrome may throw AFTER actually closing the tab (race with
      // window-close cascades). Check with tabs.get: if it reports
      // "No tab with id", we know Chrome closed it and we should
      // unregister. Otherwise leave state intact. Fixes #75
      // (over-closing in closeOldestUntil).
      try {
        await browser.tabs.get(tabIdToClose);
        // Tab still exists — caller should get null so the outer
        // loop knows it didn't close anything.
        log.warn("tabs.remove threw but tab still exists", {
          tabId: String(tabIdToClose),
          error: error instanceof Error ? error.message : String(error),
        });
      } catch {
        // tabs.get also threw — tab is gone, unregister.
        this.unregister(tabIdToClose);
      }
      return null;
    }
  }

  async closeOldestUntil(
    limit: number,
    tree: NavigationTree | null = null,
    options?: { activeTabIds?: Set<TabId>; skipLoading?: boolean },
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
        [...(this.index["nodeToTabs"]?.entries?.() ?? [])].map(([k, v]) => [k, [...v]]),
      ),
      lruOrder: [...this.lru.iter()],
      lastUsed: Object.fromEntries(this.lru["lastUsed"]?.entries?.() ?? []),
      latestTabId: this.lru.getLatestTabId(),
      latestNodeId: this.lru.getLatestNodeId(),
    };
  }
}

export const tabManager = new TabManager();
