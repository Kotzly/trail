import type { NodeId, Timestamp, Title, Url } from "@shared/types/ids.js";
import MiniSearch from "minisearch";
import { TreeNode } from "./tree-node.js";
import { DefaultNavigationOptions, type NavigationOptions } from "@shared/types/tree.js";
import { type NodeData, type NavigationNode, updateNodeMeta } from "@shared/types/node.js";
import { createUrlKey } from "@shared/lib/url-key.js";

export type NodeRedirect = { from: NodeId; to: NodeId };
export type DeleteNodeResult = { removed: NavigationNode[]; redirects: NodeRedirect[] };

export class NavigationTree {
  private root: NavigationNode | null = null;
  private current: NavigationNode | null = null;
  private nodeCount: number = 0;
  private nodeMap: Map<NodeId, NavigationNode> = new Map<NodeId, NavigationNode>();
  private searchIndex: MiniSearch;
  private searchDocs: Map<NodeId, SearchDoc> = new Map<NodeId, SearchDoc>();
  /**
   * O(1) URL-key → nodes index. One key can map to multiple nodes
   * (same URL visited from two different parts of the tree); callers
   * use `findByUrl(url, near?)` to pick the closest one. Maintained
   * by createChild / updateNodeData / deleteNode / merge paths.
   */
  private urlIndex: Map<string, Set<NavigationNode>> = new Map();

  /**
   * Subscribers to node-deletion events. Notified whenever any
   * deleteNode / deleteChildren / deleteSubtree / merge path removes
   * nodes from this tree. TabManager hooks in here so tabs mapped
   * to deleted nodes are released (#22, #29).
   */
  private nodesDeletedListeners: Array<(ids: NodeId[]) => void> = [];

  onNodesDeleted(listener: (ids: NodeId[]) => void): () => void {
    this.nodesDeletedListeners.push(listener);
    return () => {
      const idx = this.nodesDeletedListeners.indexOf(listener);
      if (idx !== -1) this.nodesDeletedListeners.splice(idx, 1);
    };
  }

  private emitNodesDeleted(ids: NodeId[]): void {
    if (ids.length === 0) return;
    for (const listener of this.nodesDeletedListeners) {
      try {
        listener(ids);
      } catch {
        // Subscriber errors must not corrupt tree state.
      }
    }
  }

  constructor(root?: NavigationNode) {
    this.searchIndex = NavigationTree.createSearchIndex();
    this.nodeCount = 0;
    if (root) {
      this.constructFromRoot(root);
    }
  }

  private constructFromRoot(root: NavigationNode): void {
    this.root = root;
    let count = 0;
    const docs: SearchDoc[] = [];

    this.root.forEach((node) => {
      this.nodeMap.set(node.id, node);
      const doc = NavigationTree.buildSearchDoc(node);
      docs.push(doc);
      this.searchDocs.set(node.id, doc);
      this.indexUrlForNode(node);
      ++count;
    });
    if (docs.length > 0) {
      this.searchIndex.addAll(docs);
    }

    this.nodeCount = count;
  }

  private indexUrlForNode(node: NavigationNode): void {
    const key = createUrlKey(node.data.url);
    if (!key) return;
    let set = this.urlIndex.get(key);
    if (!set) {
      set = new Set();
      this.urlIndex.set(key, set);
    }
    set.add(node);
  }

  private unindexUrlForNode(node: NavigationNode, urlKey?: string): void {
    const key = urlKey ?? createUrlKey(node.data.url);
    if (!key) return;
    const set = this.urlIndex.get(key);
    if (!set) return;
    set.delete(node);
    if (set.size === 0) this.urlIndex.delete(key);
  }

  size(): number {
    return this.nodeCount;
  }

  getRoot(): NavigationNode | null {
    return this.root;
  }

  getCurrent(): NavigationNode | null {
    return this.current;
  }

  setCurrent(node: NavigationNode): void {
    this.current = node;
  }

  *iter(): IterableIterator<NavigationNode> {
    if (this.root) {
      yield* this.root.iter();
    }
  }

  private mergeNodeData(base: NodeData, incoming: NodeData): NodeData {
    const tags = Array.from(new Set([...(base.tags ?? []), ...(incoming.tags ?? [])]));
    const title = incoming.title ? incoming.title : base.title;
    const favicon = incoming.favicon !== undefined ? incoming.favicon : base.favicon;

    // kind is monotonic: "burst-item" can promote to "normal", never
    // the other way. If either side promoted to normal (or is implicit
    // normal), result is normal. Otherwise preserve the most specific
    // existing kind.
    let mergedKind: NodeData["kind"] = base.kind ?? incoming.kind;
    if (base.kind === "normal" || incoming.kind === "normal") {
      mergedKind = "normal";
    } else if (!base.kind && !incoming.kind) {
      mergedKind = undefined; // both implicit normal
    }

    // burst.status is monotonic: sealed beats open. Take the side
    // whose status is sealed; if both same, prefer the larger
    // lastItemAt so divergent bursts converge to the latest extent.
    let mergedBurst: NodeData["burst"] = base.burst ?? incoming.burst;
    if (base.burst && incoming.burst) {
      const baseSealed = base.burst.status === "sealed";
      const incSealed = incoming.burst.status === "sealed";
      if (baseSealed || incSealed) {
        mergedBurst = {
          ...(baseSealed ? base.burst : incoming.burst),
          status: "sealed",
          lastItemAt: Math.max(
            base.burst.lastItemAt as number,
            incoming.burst.lastItemAt as number,
          ) as Timestamp,
        };
      } else {
        mergedBurst =
          (base.burst.lastItemAt as number) >= (incoming.burst.lastItemAt as number)
            ? base.burst
            : incoming.burst;
      }
    }

    // LWW for pinned + layout based on the stamped *UpdatedAt fields.
    // If both sides have a stamp, newer wins. If only one, that one
    // wins. If neither has a stamp, we fall back to the previous
    // conservative policies (OR for pinned, base-wins for layout).
    const basePinAt = base.pinnedUpdatedAt ?? 0;
    const incPinAt = incoming.pinnedUpdatedAt ?? 0;
    let pinned = Boolean(base.pinned || incoming.pinned);
    let pinnedUpdatedAt = base.pinnedUpdatedAt ?? incoming.pinnedUpdatedAt;
    if (basePinAt || incPinAt) {
      pinned = incPinAt > basePinAt ? incoming.pinned : base.pinned;
      pinnedUpdatedAt =
        (incPinAt > basePinAt ? incoming.pinnedUpdatedAt : base.pinnedUpdatedAt) ?? pinnedUpdatedAt;
    }

    const baseLayoutAt = base.layoutUpdatedAt ?? 0;
    const incLayoutAt = incoming.layoutUpdatedAt ?? 0;
    let layout = base.layout ?? incoming.layout;
    let layoutUpdatedAt = base.layoutUpdatedAt ?? incoming.layoutUpdatedAt;
    if (baseLayoutAt || incLayoutAt) {
      layout = incLayoutAt > baseLayoutAt ? incoming.layout : base.layout;
      layoutUpdatedAt =
        (incLayoutAt > baseLayoutAt ? incoming.layoutUpdatedAt : base.layoutUpdatedAt) ??
        layoutUpdatedAt;
    }

    return {
      ...base,
      url: base.url,
      title,
      favicon,
      pinned,
      ...(pinnedUpdatedAt ? { pinnedUpdatedAt } : {}),
      tags,
      ...(layout ? { layout } : {}),
      ...(layoutUpdatedAt ? { layoutUpdatedAt } : {}),
      ...(mergedKind ? { kind: mergedKind } : {}),
      ...(mergedBurst ? { burst: mergedBurst } : {}),
    } as NodeData;
  }

  /**
   * Walk up from `node` to root, returning true if any ancestor
   * (including `node` itself) is `ancestor`.
   */
  private isDescendantOf(node: NavigationNode, ancestor: NavigationNode): boolean {
    let cursor: NavigationNode | null = node;
    while (cursor) {
      if (cursor === ancestor) return true;
      cursor = cursor.getParent();
    }
    return false;
  }

  private mergeDuplicateChildren(parent: NavigationNode): NodeRedirect[] {
    const redirects: NodeRedirect[] = [];
    const seen = new Map<string, NavigationNode>();

    // Iterate over a copy since we may detach nodes during merging.
    const children = [...parent.getChildren()];
    for (const child of children) {
      const key = createUrlKey(child.data.url);
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, child);
        continue;
      }

      existing.data = this.mergeNodeData(existing.data, child.data);
      this.updateSearchEntry(existing);

      // Ancestor-chain intersection: if `this.current` is a
      // descendant of the subtree we're merging away (not just the
      // direct child), re-point to the survivor. Previously only
      // `this.current.id === child.id` was checked, leaving the
      // cursor dangling in a merged-away subtree and making it a
      // zombie (reachable via nodeMap but unreachable from root).
      if (this.current && this.isDescendantOf(this.current, child)) {
        this.current = existing;
      }

      child.transferChildrenTo(existing);
      child.detach();

      this.nodeMap.delete(child.id);
      this.removeSearchEntry(child.id);
      this.unindexUrlForNode(child);
      this.nodeCount = Math.max(0, this.nodeCount - 1);

      redirects.push({ from: child.id, to: existing.id });
      redirects.push(...this.mergeDuplicateChildren(existing));
    }

    return redirects;
  }

  navigate(data: NodeData, options: NavigationOptions = DefaultNavigationOptions): NavigationNode {
    return this.navigateUnder(this.current?.id ?? null, data, {
      ...options,
      setAsCurrent: true,
    });
  }

  /**
   * Attach a new node under an explicit parent (identified by id).
   *
   * This is the core primitive that Phase 2's opener-based parent
   * inference uses — callers resolve the parent from the opener tab,
   * not from `tree.current`, so background-tab navigations don't
   * silently attach under whatever the sidepanel is looking at.
   *
   * Behavior:
   * - If `parentId` is null or unknown, attach as a root sibling
   *   (creates root if the tree is empty, otherwise attaches to the
   *   existing root). Never falls back to `this.current`.
   * - Same-URL-as-parent: update metadata in place, return parent.
   * - Same-URL-as-existing-child: return that child.
   * - backOnRevisit: walks ancestors of the parent for a URL match.
   * - Otherwise: creates a fresh child of parent.
   * - `setAsCurrent` (default false) controls whether to advance the
   *   UI cursor. Callers that represent programmatic/background
   *   navigations should pass false.
   */
  navigateUnder(
    parentId: NodeId | null,
    data: NodeData,
    options: NavigationOptions & { setAsCurrent?: boolean } = DefaultNavigationOptions,
  ): NavigationNode {
    const setAsCurrent = options.setAsCurrent ?? false;

    // no root ==> create it
    if (!this.root) {
      this.root = this.createChild(null, data);
      if (setAsCurrent || !this.current) this.current = this.root;
      return this.root;
    }

    // Resolve the parent. Unknown parentId or null falls back to the
    // tree's root — NOT to `this.current` (that was the original bug).
    const parent = (parentId !== null ? this.findNodeById(parentId) : null) ?? this.root;

    const targetKey = createUrlKey(data.url);
    const parentKey = createUrlKey(parent.data.url);

    // same url as parent ==> update metadata
    if (parentKey === targetKey) {
      parent.data = updateNodeMeta(parent.data, data);
      this.updateSearchEntry(parent);
      if (setAsCurrent) this.current = parent;
      return parent;
    }

    // if parent has a child with the same url ==> update metadata + use it
    const existingChild = parent.getChildren().find((c) => createUrlKey(c.data.url) === targetKey);
    if (existingChild) {
      existingChild.data = updateNodeMeta(existingChild.data, data);
      this.updateSearchEntry(existingChild);
      if (setAsCurrent) this.current = existingChild;
      return existingChild;
    }

    // if backOnRevisit: search ancestors of the parent
    if (options.backOnRevisit ?? DefaultNavigationOptions.backOnRevisit) {
      let ancestor = parent.getParent();
      while (ancestor) {
        if (createUrlKey(ancestor.data.url) === targetKey) {
          ancestor.data = updateNodeMeta(ancestor.data, data);
          this.updateSearchEntry(ancestor);
          if (setAsCurrent) this.current = ancestor;
          return ancestor;
        }
        ancestor = ancestor.getParent();
      }
    }

    // create a child of `parent`
    const newChild = this.createChild(parent, data);
    if (setAsCurrent) this.current = newChild;
    return newChild;
  }

  createChild(node: NavigationNode | null, data: NodeData): NavigationNode {
    const child = node ? node.addChild(data) : new TreeNode(data);
    this.nodeMap.set(child.id, child);
    this.updateSearchEntry(child);
    this.indexUrlForNode(child);
    this.nodeCount++;
    return child;
  }

  findNodeById(id: NodeId): NavigationNode | null {
    const node = this.nodeMap.get(id);
    return node ?? null;
  }

  private collectSubtreeNodes(node: NavigationNode): NavigationNode[] {
    const nodes: NavigationNode[] = [];
    for (const n of node.iter()) {
      nodes.push(n);
    }
    return nodes;
  }

  deleteNode(nodeId: NodeId): DeleteNodeResult {
    const node = this.findNodeById(nodeId);
    if (!node || node.isRoot()) return { removed: [], redirects: [] };

    const parent = node.getParent();
    const removed: NavigationNode[] = [node];
    let redirects: NodeRedirect[] = [];

    node.remove();
    this.nodeMap.delete(node.id);
    this.removeSearchEntry(node.id);
    this.unindexUrlForNode(node);
    this.nodeCount = Math.max(0, this.nodeCount - 1);

    if (this.current && this.current.id === nodeId) {
      if (parent) this.current = parent;
      else this.current = this.root;
    }

    if (parent) {
      redirects = this.mergeDuplicateChildren(parent);
    }

    const deletedIds = [node.id, ...redirects.map((r) => r.from)];
    this.emitNodesDeleted(deletedIds);

    return { removed, redirects };
  }

  deleteChildren(nodeId: NodeId): NavigationNode[] {
    const node = this.findNodeById(nodeId);
    if (!node) return [];

    const children = [...node.getChildren()];
    const removed: NavigationNode[] = [];

    for (const child of children) {
      removed.push(...this.collectSubtreeNodes(child));
      child.detach();
    }

    for (const removedNode of removed) {
      this.nodeMap.delete(removedNode.id);
      this.removeSearchEntry(removedNode.id);
      this.unindexUrlForNode(removedNode);
    }
    this.nodeCount = Math.max(0, this.nodeCount - removed.length);

    if (this.current && removed.some((n) => n.id === this.current?.id)) {
      this.current = node;
    }

    this.emitNodesDeleted(removed.map((n) => n.id));
    return removed;
  }

  deleteSubtree(nodeId: NodeId): NavigationNode[] {
    const node = this.findNodeById(nodeId);
    if (!node) return [];

    const removed = this.collectSubtreeNodes(node);

    if (node.isRoot()) {
      this.root = null;
      this.current = null;
      this.nodeMap.clear();
      this.searchIndex = NavigationTree.createSearchIndex();
      this.searchDocs.clear();
      this.urlIndex.clear();
      this.nodeCount = 0;
      this.emitNodesDeleted(removed.map((n) => n.id));
      return removed;
    }

    const parent = node.getParent();
    node.detach();

    for (const removedNode of removed) {
      this.nodeMap.delete(removedNode.id);
      this.removeSearchEntry(removedNode.id);
      this.unindexUrlForNode(removedNode);
    }
    this.nodeCount = Math.max(0, this.nodeCount - removed.length);

    if (this.current && removed.some((n) => n.id === this.current?.id)) {
      this.current = parent ?? null;
    }

    this.emitNodesDeleted(removed.map((n) => n.id));
    return removed;
  }

  clear(): void {
    this.root = null;
    this.current = null;
    this.nodeMap.clear();
    this.searchIndex = NavigationTree.createSearchIndex();
    this.searchDocs.clear();
    this.urlIndex.clear();
    this.nodeCount = 0;
  }

  collectPinned(root: NavigationNode | null = this.root): Set<NavigationNode> {
    const pinned: Set<NavigationNode> = new Set<NavigationNode>();
    root?.forEach((node: NavigationNode) => {
      if (node.data?.pinned) {
        pinned.add(node);
      }
    });
    return pinned;
  }

  findNodesByQuery(query: string): NodeId[] {
    const q = query.trim();
    if (!q) return [];
    const results = this.searchIndex.search(q, { combineWith: "AND" }) as Array<{ id: NodeId }>;
    const ids = results.map((result) => result.id);
    ids.sort((a, b) => {
      const nodeA = this.nodeMap.get(a);
      const nodeB = this.nodeMap.get(b);
      const timeA = nodeA?.timestamp ?? 0;
      const timeB = nodeB?.timestamp ?? 0;
      if (timeA === timeB) return (a as string).localeCompare(b as string);
      return timeA - timeB;
    });
    return ids;
  }

  /**
   * O(1) URL lookup via the urlIndex. When multiple nodes share the
   * same URL key (same URL reached from two different parts of the
   * tree), prefer the one closest to `near` (via ancestor walk). If
   * `near` is not provided, return the first match in insertion
   * order. Never returns a detached node (those are unindexed on
   * delete).
   */
  findByUrl(url: Url, near?: NavigationNode): NavigationNode | null {
    const targetKey = createUrlKey(url);
    if (!targetKey) return null;
    const set = this.urlIndex.get(targetKey);
    if (!set || set.size === 0) return null;
    if (set.size === 1 || !near) {
      return set.values().next().value ?? null;
    }
    // Proximity: walk up from `near` to root; the first ancestor
    // that's in the set wins.
    let cursor: NavigationNode | null = near;
    while (cursor) {
      if (set.has(cursor)) return cursor;
      cursor = cursor.getParent();
    }
    // Otherwise, walk down from `near`'s subtree looking for a match.
    for (const node of near.iter()) {
      if (set.has(node)) return node;
    }
    // No proximity winner — fall back to the first inserted.
    return set.values().next().value ?? null;
  }

  /**
   * Set the current cursor by id.
   * Returns true if the node was found and current was updated;
   * false if the id does not exist (silent no-op for the caller's
   * awareness — callers that need to react to a miss should check).
   */
  setCurrentById(nodeId: NodeId): boolean {
    const node = this.findNodeById(nodeId);
    if (!node) return false;
    this.setCurrent(node);
    return true;
  }

  getCurrentId(): NodeId | null {
    return this.current?.id ?? null;
  }

  clearCurrent(): void {
    this.current = null;
  }

  refreshSearchEntry(nodeId: NodeId): void {
    const node = this.findNodeById(nodeId);
    if (!node) return;
    this.updateSearchEntry(node);
  }

  /**
   * Centralized node-data mutation. All external writers should go
   * through this instead of `node.data = {...}` so invariants stay
   * intact:
   *   - search index is refreshed if url / title / favicon changed
   *   - URL-key index (added in a follow-up commit) stays consistent
   *   - future mutation subscribers (for sidepanel sync) can observe
   *
   * Returns the updated node or null if the id wasn't found.
   */
  updateNodeData(nodeId: NodeId, patch: Partial<NodeData>): NavigationNode | null {
    const node = this.findNodeById(nodeId);
    if (!node) return null;
    const prev = node.data;
    const next: NodeData = { ...prev, ...patch } as NodeData;
    const prevUrlKey = createUrlKey(prev.url);
    const nextUrlKey = createUrlKey(next.url);
    node.data = next;
    if (prevUrlKey !== nextUrlKey) {
      this.unindexUrlForNode(node, prevUrlKey);
      this.indexUrlForNode(node);
    }
    const searchAffected =
      prev.url !== next.url || prev.title !== next.title || prev.favicon !== next.favicon;
    if (searchAffected) {
      this.updateSearchEntry(node);
    }
    return node;
  }

  private updateSearchEntry(node: NavigationNode): void {
    const existing = this.searchDocs.get(node.id);
    if (existing) {
      this.searchIndex.remove(existing);
    }
    const doc = NavigationTree.buildSearchDoc(node);
    this.searchIndex.add(doc);
    this.searchDocs.set(node.id, doc);
  }

  private removeSearchEntry(nodeId: NodeId): void {
    const existing = this.searchDocs.get(nodeId);
    if (!existing) return;
    this.searchIndex.remove(existing);
    this.searchDocs.delete(nodeId);
  }

  private static createSearchIndex(): MiniSearch {
    return new MiniSearch({
      fields: ["title", "url", "domain"],
      idField: "id",
      storeFields: ["id"],
      searchOptions: {
        boost: { title: 3, domain: 2, url: 1 },
        prefix: true,
        fuzzy: 0.2,
      },
    });
  }

  private static buildSearchDoc(node: NavigationNode): SearchDoc {
    const title = node.data.title || ("" as Title);
    const url = node.data.url || ("" as Url);
    const domain = NavigationTree.extractDomain(url);
    return { id: node.id, title, url, domain };
  }

  private static extractDomain(url: Url): string {
    if (!url) return "";
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      const match = url.match(/^(?:https?:\/\/)?([^\/?#]+)/i);
      return match ? match[1]!.toLowerCase() : "";
    }
  }
}

type SearchDoc = {
  id: NodeId;
  title: Title;
  url: Url;
  domain: string;
};
