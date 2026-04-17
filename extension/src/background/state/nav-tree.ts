import type { NodeId, Title, Url } from "@shared/types/ids.js";
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
      ++count;
    });
    if (docs.length > 0) {
      this.searchIndex.addAll(docs);
    }

    this.nodeCount = count;
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
    const layout = base.layout ?? incoming.layout;
    return {
      ...base,
      url: base.url,
      title,
      favicon,
      pinned: Boolean(base.pinned || incoming.pinned),
      tags,
      ...(layout ? { layout } : {}),
    } as NodeData;
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

      child.transferChildrenTo(existing);
      child.detach();

      this.nodeMap.delete(child.id);
      this.removeSearchEntry(child.id);
      this.nodeCount = Math.max(0, this.nodeCount - 1);

      if (this.current && this.current.id === child.id) {
        this.current = existing;
      }

      redirects.push({ from: child.id, to: existing.id });
      redirects.push(...this.mergeDuplicateChildren(existing));
    }

    return redirects;
  }

  navigate(data: NodeData, options: NavigationOptions = DefaultNavigationOptions): NavigationNode {
    // no root ==> create it
    if (!this.root) {
      this.root = this.createChild(null, data);
      this.current = this.root;
      return this.root;
    }

    // QUESTION: how should we handle this.current === null?
    if (!this.current) {
      this.current = this.root;
    }

    const targetKey = createUrlKey(data.url);
    const currentKey = createUrlKey(this.current.data.url);

    // same url as current ==> update metadata
    if (currentKey === targetKey) {
      this.current.data = updateNodeMeta(this.current.data, data);
      this.updateSearchEntry(this.current);
      return this.current;
    }

    // if current has a child with the same url ==> update metadata
    const existingChild = this.current
      .getChildren()
      .find((c) => createUrlKey(c.data.url) === targetKey);
    if (existingChild) {
      existingChild.data = updateNodeMeta(existingChild.data, data);
      this.updateSearchEntry(existingChild);
      this.current = existingChild;
      return existingChild;
    }

    // if backOnRevisit: search ancestors
    if (options.backOnRevisit ?? DefaultNavigationOptions.backOnRevisit) {
      let ancestor = this.current.getParent();
      while (ancestor) {
        if (createUrlKey(ancestor.data.url) === targetKey) {
          ancestor.data = updateNodeMeta(ancestor.data, data);
          this.updateSearchEntry(ancestor);
          this.current = ancestor;
          return ancestor;
        }
        ancestor = ancestor.getParent();
      }
    }

    // create a child
    const newChild = this.createChild(this.current, data);
    this.current = newChild;
    return newChild;
  }

  createChild(node: NavigationNode | null, data: NodeData): NavigationNode {
    const child = node ? node.addChild(data) : new TreeNode(data);
    this.nodeMap.set(child.id, child);
    this.updateSearchEntry(child);
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
    this.nodeCount = Math.max(0, this.nodeCount - 1);

    if (this.current && this.current.id === nodeId) {
      if (parent) this.current = parent;
      else this.current = this.root;
    }

    if (parent) {
      redirects = this.mergeDuplicateChildren(parent);
    }

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
    }
    this.nodeCount = Math.max(0, this.nodeCount - removed.length);

    if (this.current && removed.some((n) => n.id === this.current?.id)) {
      this.current = node;
    }

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
      this.nodeCount = 0;
      return removed;
    }

    const parent = node.getParent();
    node.detach();

    for (const removedNode of removed) {
      this.nodeMap.delete(removedNode.id);
      this.removeSearchEntry(removedNode.id);
    }
    this.nodeCount = Math.max(0, this.nodeCount - removed.length);

    if (this.current && removed.some((n) => n.id === this.current?.id)) {
      this.current = parent ?? null;
    }

    return removed;
  }

  clear(): void {
    this.root = null;
    this.current = null;
    this.nodeMap.clear();
    this.searchIndex = NavigationTree.createSearchIndex();
    this.searchDocs.clear();
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

  findByUrl(url: Url): NavigationNode | null {
    const targetKey = createUrlKey(url);
    for (const node of this.iter() ?? []) {
      if (createUrlKey(node.data.url) === targetKey) {
        return node;
      }
    }
    return null;
  }

  setCurrentById(nodeId: NodeId): void {
    const node = this.findNodeById(nodeId);
    if (!node) return;
    this.setCurrent(node);
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
