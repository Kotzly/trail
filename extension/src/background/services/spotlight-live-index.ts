import MiniSearch from '../../shared/vendor/minisearch.js';
import { NavigationTreeMapper } from '@shared/lib/mapper.js';
import type { NavigationNode } from '@shared/types/node.js';
import type { ArchiveIndexEntry } from '@shared/types/tree.js';
import type { NodeId } from '@shared/types/ids.js';
import type {
  SpotlightGraphPreviewData,
  SpotlightSuggestionGroup,
  SpotlightTreeRelation,
} from '@shared/rpc/contracts.js';
import { treeStorage } from './tree-storage.js';
import { tabManager } from '../state/tab-manager.js';
import { loadTree } from './tree-loader.js';

export type SpotlightLiveNodeDoc = {
  kind: 'node';
  key: string;
  treeId: string;
  treeName: string;
  nodeId: NodeId;
  title: string;
  url: string;
  favicon?: string;
  group: SpotlightSuggestionGroup;
  recency: number;
  isCurrent: boolean;
  tabCount: number;
  visitCount: number;
  pinned: boolean;
  domain: string;
  parentId: NodeId | null;
  childIds: NodeId[];
  path: NodeId[];
  depth: number;
  haystack: string;
};

export type SpotlightLiveTreeDoc = {
  kind: 'tree';
  key: string;
  treeId: string;
  treeName: string;
  rootUrl: string;
  favicon?: string;
  recency: number;
  domain: string;
  haystack: string;
  group: 'other-trees';
};

export type SpotlightLiveDoc = SpotlightLiveNodeDoc | SpotlightLiveTreeDoc;

export type SpotlightLiveSnapshot = {
  version: number;
  index: MiniSearch;
  docsByKey: Map<string, SpotlightLiveDoc>;
  nodeDocs: SpotlightLiveNodeDoc[];
  treeDocs: SpotlightLiveTreeDoc[];
  activeTreeId: string;
  activeTreeName: string;
  previewsByTreeId: Map<string, SpotlightGraphPreviewData>;
  tree: ReturnType<typeof NavigationTreeMapper.toJSON>;
  currentNodeId: NodeId | null;
  currentPath: NodeId[];
  openNodeIds: NodeId[];
  nodeRecency: Record<NodeId, number>;
  nodeTabCounts: Record<NodeId, number>;
};

const SEARCH_FIELDS = ['title', 'url', 'domain', 'treeName'] as const;

type IndexDoc = {
  key: string;
  title: string;
  url: string;
  domain: string;
  treeName: string;
};

export class SpotlightLiveIndexService {
  private snapshot: SpotlightLiveSnapshot | null = null;
  private dirty = true;
  private version = 0;

  invalidate(): void {
    this.dirty = true;
  }

  async buildInitialIndex(): Promise<void> {
    await this.ensureFresh();
  }

  upsertNode(_nodeId: NodeId): void {
    this.invalidate();
  }

  removeNode(_nodeId: NodeId): void {
    this.invalidate();
  }

  refreshArchivedTrees(): void {
    this.invalidate();
  }

  refreshCurrentNodeContext(): void {
    this.invalidate();
  }

  async getSnapshot(): Promise<SpotlightLiveSnapshot> {
    await this.ensureFresh();
    return this.snapshot as SpotlightLiveSnapshot;
  }

  private async ensureFresh(): Promise<void> {
    if (this.snapshot && !this.dirty) return;
    this.snapshot = await this.rebuild();
    this.dirty = false;
  }

  private async rebuild(): Promise<SpotlightLiveSnapshot> {
    const tree = await treeStorage.getOrCreateTree();
    const activeMeta = await treeStorage.getActiveMeta();
    const treeJSON = NavigationTreeMapper.toJSON(tree);
    const currentNodeId = tree.getCurrentId();
    const openNodeSet = new Set(tabManager.openNodes());
    const openNodeIds = Array.from(openNodeSet);
    const nodeRecency = {} as Record<NodeId, number>;
    const nodeTabCounts = {} as Record<NodeId, number>;

    for (const nodeId of openNodeIds) {
      const recency = tabManager.getNodeRecency(nodeId);
      if (recency > 0) nodeRecency[nodeId] = recency;
      nodeTabCounts[nodeId] = tabManager.tabCountForNode(nodeId);
    }

    const nodeDocs: SpotlightLiveNodeDoc[] = [];
    const docsByKey = new Map<string, SpotlightLiveDoc>();
    const pathByNodeId = new Map<NodeId, NodeId[]>();

    const root = tree.getRoot();
    if (root) {
      collectPaths(root, [], pathByNodeId);
    }

    for (const node of tree.iter()) {
      const doc = createNodeDoc(node, {
        treeId: activeMeta.id,
        treeName: activeMeta.label,
        currentNodeId,
        nodeRecency,
        nodeTabCounts,
        openNodeSet,
        pathByNodeId,
      });
      nodeDocs.push(doc);
      docsByKey.set(doc.key, doc);
    }

    const previewsByTreeId = new Map<string, SpotlightGraphPreviewData>();
    const archiveEntries = await treeStorage.getArchivedSummaries();
    const treeDocs = archiveEntries.map((entry) => createTreeDoc(entry));
    for (const doc of treeDocs) {
      docsByKey.set(doc.key, doc);
    }
    const archiveRecords = await Promise.all(archiveEntries.map(async (entry) => ({
      entry,
      record: await loadTree(entry.id),
    })));
    for (const { entry, record } of archiveRecords) {
      if (!record) continue;
      previewsByTreeId.set(entry.id, createPreviewData(record.id, record.label, record.tree));
      const archiveTree = NavigationTreeMapper.fromJSON(record.tree);
      const archivePathByNodeId = new Map<NodeId, NodeId[]>();
      const archiveRoot = archiveTree.getRoot();
      if (archiveRoot) {
        collectPaths(archiveRoot, [], archivePathByNodeId);
      }
      const archiveNodeRecency = buildTreeNodeRecencyMap(archiveTree);
      const archiveNodeTabCounts = {} as Record<NodeId, number>;
      const archiveOpenNodeSet = new Set<NodeId>();
      for (const archiveNode of archiveTree.iter()) {
        const doc = createNodeDoc(archiveNode, {
          treeId: record.id,
          treeName: record.label,
          currentNodeId: null,
          nodeRecency: archiveNodeRecency,
          nodeTabCounts: archiveNodeTabCounts,
          openNodeSet: archiveOpenNodeSet,
          pathByNodeId: archivePathByNodeId,
          groupOverride: 'other-trees',
        });
        nodeDocs.push(doc);
        docsByKey.set(doc.key, doc);
      }
    }

    const index = new MiniSearch({
      fields: [...SEARCH_FIELDS],
      idField: 'key',
      storeFields: ['key'],
      searchOptions: {
        boost: { title: 4, domain: 3, treeName: 2, url: 1 },
        prefix: true,
        fuzzy: 0.25,
        combineWith: 'AND',
      },
    });

    const indexDocs: IndexDoc[] = [
      ...nodeDocs.map((doc) => ({
        key: doc.key,
        title: doc.title,
        url: doc.url,
        domain: doc.domain,
        treeName: doc.treeName,
      })),
      ...treeDocs.map((doc) => ({
        key: doc.key,
        title: doc.treeName,
        url: doc.rootUrl,
        domain: doc.domain,
        treeName: doc.treeName,
      })),
    ];
    index.addAll(indexDocs);

    this.version += 1;

    return {
      version: this.version,
      index,
      docsByKey,
      nodeDocs,
      treeDocs,
      activeTreeId: activeMeta.id,
      activeTreeName: activeMeta.label,
      previewsByTreeId,
      tree: treeJSON,
      currentNodeId,
      currentPath: currentNodeId ? pathByNodeId.get(currentNodeId) ?? [] : [],
      openNodeIds,
      nodeRecency,
      nodeTabCounts,
    };
  }
}

export function computeTreeRelation(
  doc: SpotlightLiveNodeDoc,
  currentNodeId: NodeId | null,
  currentPath: NodeId[],
): SpotlightTreeRelation {
  if (!currentNodeId || currentPath.length === 0) return 'other-branch';
  if (doc.nodeId === currentNodeId) return 'current';
  if (doc.childIds.includes(currentNodeId)) return 'parent';
  if (doc.parentId === currentNodeId) return 'child';

  const currentParentId = currentPath.length > 1 ? currentPath[currentPath.length - 2] ?? null : null;
  if (doc.parentId === currentParentId && currentParentId !== null) {
    return 'sibling';
  }

  const lcaDepth = getLowestCommonAncestorDepth(doc.path, currentPath);
  if (lcaDepth === 0) return 'other-branch';
  if (isAncestorPath(doc.path, currentPath) || isAncestorPath(currentPath, doc.path)) {
    return 'same-branch';
  }
  return 'other-branch';
}

export function computeGraphBoosts(
  doc: SpotlightLiveNodeDoc,
  activeTreeId: string,
  currentNodeId: NodeId | null,
  currentPath: NodeId[],
): { graphProximityBoost: number; branchAffinityBoost: number; relation: SpotlightTreeRelation } {
  if (doc.treeId !== activeTreeId) {
    return { graphProximityBoost: 0, branchAffinityBoost: 0, relation: 'other-branch' };
  }
  const relation = computeTreeRelation(doc, currentNodeId, currentPath);
  switch (relation) {
    case 'current':
      return { graphProximityBoost: 0, branchAffinityBoost: 0, relation };
    case 'parent':
    case 'child':
      return { graphProximityBoost: 3, branchAffinityBoost: 1.2, relation };
    case 'sibling':
      return { graphProximityBoost: 2.2, branchAffinityBoost: 0.9, relation };
    case 'same-branch': {
      const distance = Math.abs(doc.path.length - currentPath.length);
      return distance <= 2
        ? { graphProximityBoost: 1.6, branchAffinityBoost: 0.8, relation }
        : { graphProximityBoost: 1.0, branchAffinityBoost: 0.5, relation };
    }
    case 'other-branch':
    default:
      return { graphProximityBoost: currentNodeId ? 0.4 : 0, branchAffinityBoost: 0, relation };
  }
}

function createNodeDoc(
  node: NavigationNode,
  options: {
    treeId: string;
    treeName: string;
    currentNodeId: NodeId | null;
    nodeRecency: Record<NodeId, number>;
    nodeTabCounts: Record<NodeId, number>;
    openNodeSet: Set<NodeId>;
    pathByNodeId: Map<NodeId, NodeId[]>;
    groupOverride?: SpotlightSuggestionGroup;
  },
): SpotlightLiveNodeDoc {
  const recency = options.nodeRecency[node.id] ?? node.data.lastVisitedAt ?? node.timestamp ?? 0;
  const isOpen = options.openNodeSet.has(node.id);
  const group: SpotlightSuggestionGroup = options.groupOverride
    ?? (isOpen
      ? 'open-tabs'
      : recency > 0
        ? 'recently-closed'
        : 'current-tree');
  const path = options.pathByNodeId.get(node.id) ?? [node.id];
  return {
    kind: 'node',
    key: `n:${options.treeId}:${node.id}`,
    treeId: options.treeId,
    treeName: options.treeName,
    nodeId: node.id,
    title: node.data.title || 'Untitled',
    url: node.data.url,
    ...(node.data.favicon ? { favicon: node.data.favicon as string } : {}),
    group,
    recency,
    isCurrent: options.currentNodeId === node.id,
    tabCount: options.nodeTabCounts[node.id] ?? 0,
    visitCount: typeof node.data.visitCount === 'number' ? node.data.visitCount : 0,
    pinned: Boolean(node.data.pinned),
    domain: extractDomain(node.data.url),
    parentId: node.getParent()?.id ?? null,
    childIds: node.getChildren().map((child) => child.id),
    path,
    depth: Math.max(0, path.length - 1),
    haystack: buildHaystack([
      node.data.title || 'Untitled',
      node.data.url,
      extractDomain(node.data.url),
      options.treeName,
    ]),
  };
}

function buildTreeNodeRecencyMap(tree: ReturnType<typeof NavigationTreeMapper.fromJSON>): Record<NodeId, number> {
  const nodeRecency = {} as Record<NodeId, number>;
  for (const node of tree.iter()) {
    const recency = node.data.lastVisitedAt ?? node.timestamp ?? 0;
    if (recency > 0) {
      nodeRecency[node.id] = recency;
    }
  }
  return nodeRecency;
}

function createPreviewData(treeId: string, treeName: string, tree: ReturnType<typeof NavigationTreeMapper.toJSON>): SpotlightGraphPreviewData {
  const previewTree = NavigationTreeMapper.fromJSON(tree);
  const nodeRecency = buildTreeNodeRecencyMap(previewTree);
  return {
    treeId,
    treeName,
    tree,
    currentNodeId: previewTree.getCurrentId(),
    openNodeIds: [],
    tabStates: {},
    nodeTabCounts: {},
    nodeRecency,
  };
}

function collectPaths(node: NavigationNode, prefix: NodeId[], out: Map<NodeId, NodeId[]>): void {
  const path = [...prefix, node.id];
  out.set(node.id, path);
  for (const child of node.getChildren()) {
    collectPaths(child, path, out);
  }
}

function createTreeDoc(entry: ArchiveIndexEntry): SpotlightLiveTreeDoc {
  const rootUrl = entry.rootUrl || '';
  const domain = extractDomain(rootUrl);
  return {
    kind: 'tree',
    key: `t:${entry.id}`,
    treeId: entry.id,
    treeName: entry.label,
    rootUrl,
    ...(entry.rootFavicon ? { favicon: entry.rootFavicon as string } : {}),
    recency: entry.savedAt ?? 0,
    domain,
    haystack: buildHaystack([entry.label, rootUrl, domain]),
    group: 'other-trees',
  };
}

function buildHaystack(parts: string[]): string {
  return parts.join(' ').trim().toLowerCase();
}

function extractDomain(url: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function getLowestCommonAncestorDepth(a: NodeId[], b: NodeId[]): number {
  const max = Math.min(a.length, b.length);
  let depth = 0;
  for (let i = 0; i < max; i += 1) {
    if (a[i] !== b[i]) break;
    depth = i + 1;
  }
  return depth;
}

function isAncestorPath(candidate: NodeId[], other: NodeId[]): boolean {
  if (candidate.length >= other.length) return false;
  for (let i = 0; i < candidate.length; i += 1) {
    if (candidate[i] !== other[i]) return false;
  }
  return true;
}

export const spotlightLiveIndex = new SpotlightLiveIndexService();
