/**
 * Lossless conversion between NavigationTreeJSON and CompactTreeJSON.
 *
 * Round-trip guarantee: fromCompact(toCompact(tree)) deep-equals tree.
 *
 * Current format = V4. V3 decoder defaults every node to kind="normal"
 * with no burst metadata (pre-V4 data never had these fields).
 */

import type { NodeId, Timestamp, Url, Title, FaviconUrl, Tag } from "../types/ids.js";
import type { NodeData, NavigationNodeJSON, NodeKind, BurstMeta } from "../types/node.js";
import type { NavigationTreeJSON } from "../types/tree.js";
import {
  CI,
  CI_V1,
  CI_V2,
  CI_V3,
  CF,
  CK,
  CBS,
  type CompactNodeTupleV1,
  type CompactNodeTupleV2,
  type CompactNodeTupleV3,
  type CompactNodeTupleV4,
  type CompactBurstTuple,
  type CompactTreeJSON,
  type CompactTreeJSONV4,
} from "../types/compact-tree.js";

// ---------------------------------------------------------------------------
// Tree-level conversion
// ---------------------------------------------------------------------------

export function toCompact(tree: NavigationTreeJSON): CompactTreeJSON {
  return {
    v: 4,
    r: tree.root ? nodeToTuple(tree.root) : null,
    c: (tree.currentNodeId ?? null) as string | null,
    n: tree.nodeCount,
  } as CompactTreeJSONV4;
}

export function fromCompact(compact: CompactTreeJSON): NavigationTreeJSON {
  if (compact.v === 1) {
    return {
      root: compact.r ? tupleToNodeV1(compact.r) : null,
      currentNodeId: (compact.c ?? null) as NodeId | null,
      nodeCount: compact.n,
    };
  }

  if (compact.v === 2) {
    return {
      root: compact.r ? tupleToNodeV2(compact.r) : null,
      currentNodeId: (compact.c ?? null) as NodeId | null,
      nodeCount: compact.n,
    };
  }

  if (compact.v === 3) {
    return {
      root: compact.r ? tupleToNodeV3(compact.r) : null,
      currentNodeId: (compact.c ?? null) as NodeId | null,
      nodeCount: compact.n,
    };
  }

  return {
    root: compact.r ? tupleToNodeV4(compact.r) : null,
    currentNodeId: (compact.c ?? null) as NodeId | null,
    nodeCount: compact.n,
  };
}

// ---------------------------------------------------------------------------
// Node-level conversion (writer = V4)
// ---------------------------------------------------------------------------

function kindToEnum(kind: NodeKind | undefined): number {
  if (kind === "burst") return CK.BURST;
  if (kind === "burst-item") return CK.BURST_ITEM;
  return CK.NORMAL;
}

function kindFromEnum(value: number | undefined): NodeKind | undefined {
  if (value === CK.BURST) return "burst";
  if (value === CK.BURST_ITEM) return "burst-item";
  return undefined; // CK.NORMAL — omit on read to keep round-trip clean
}

function burstToTuple(burst: BurstMeta | undefined): CompactBurstTuple | null {
  if (!burst) return null;
  const status = burst.status === "sealed" ? CBS.SEALED : CBS.OPEN;
  return [
    burst.urlTemplate,
    burst.startedAt as number,
    burst.lastItemAt as number,
    status,
    burst.autoLabel ?? null,
  ];
}

function burstFromTuple(tuple: CompactBurstTuple | null): BurstMeta | undefined {
  if (!tuple) return undefined;
  return {
    urlTemplate: tuple[0],
    startedAt: tuple[1] as Timestamp,
    lastItemAt: tuple[2] as Timestamp,
    status: tuple[3] === CBS.SEALED ? "sealed" : "open",
    ...(tuple[4] != null ? { autoLabel: tuple[4] } : {}),
  };
}

function nodeToTuple(node: NavigationNodeJSON): CompactNodeTupleV4 {
  const d = node.data;
  const flags = d.pinned ? CF.PINNED : 0;

  const layout: number[] | null = d.layout ? [d.layout.offsetX, d.layout.offsetY] : null;

  return [
    node.id as string,
    node.timestamp as number,
    d.url as string,
    d.title as string,
    (d.favicon as string | undefined) ?? null,
    flags,
    d.tags as string[],
    layout,
    typeof d.lastVisitedAt === "number" && Number.isFinite(d.lastVisitedAt)
      ? d.lastVisitedAt
      : null,
    typeof d.visitCount === "number" && Number.isFinite(d.visitCount) ? d.visitCount : null,
    kindToEnum(d.kind),
    burstToTuple(d.burst),
    node.children.map(nodeToTuple),
  ];
}

function parseLayout(layoutArr: number[] | null): NodeData["layout"] | undefined {
  if (!layoutArr) return undefined;
  return { offsetX: layoutArr[0]!, offsetY: layoutArr[1]! };
}

function tupleToNodeV4(tuple: CompactNodeTupleV4): NavigationNodeJSON {
  const layout = parseLayout(tuple[CI.LAYOUT]);
  const flags = tuple[CI.FLAGS];
  const pinned = (flags & CF.PINNED) !== 0;

  const data: NodeData = {
    url: tuple[CI.URL] as Url,
    title: tuple[CI.TITLE] as Title,
    pinned,
    tags: tuple[CI.TAGS] as Tag[],
  };

  const fav = tuple[CI.FAV];
  if (fav !== null) {
    (data as { favicon?: FaviconUrl }).favicon = fav as FaviconUrl;
  }
  if (layout) {
    (data as { layout?: NodeData["layout"] }).layout = layout;
  }
  const lastVisitedAt = tuple[CI.LAST_VISITED_AT];
  if (typeof lastVisitedAt === "number" && Number.isFinite(lastVisitedAt)) {
    (data as { lastVisitedAt?: Timestamp }).lastVisitedAt = lastVisitedAt as Timestamp;
  }
  const visitCount = tuple[CI.VISIT_COUNT];
  if (typeof visitCount === "number" && Number.isFinite(visitCount) && visitCount > 0) {
    (data as { visitCount?: number }).visitCount = visitCount;
  }

  const kind = kindFromEnum(tuple[CI.KIND]);
  if (kind) {
    (data as { kind?: NodeKind }).kind = kind;
  }
  const burst = burstFromTuple(tuple[CI.BURST]);
  if (burst) {
    (data as { burst?: BurstMeta }).burst = burst;
  }

  return {
    id: tuple[CI.ID] as NodeId,
    timestamp: tuple[CI.TS] as Timestamp,
    data,
    children: tuple[CI.CHILDREN].map(tupleToNodeV4),
  };
}

function tupleToNodeV3(tuple: CompactNodeTupleV3): NavigationNodeJSON {
  const layout = parseLayout(tuple[CI_V3.LAYOUT]);
  const flags = tuple[CI_V3.FLAGS];
  const pinned = (flags & CF.PINNED) !== 0;

  const data: NodeData = {
    url: tuple[CI_V3.URL] as Url,
    title: tuple[CI_V3.TITLE] as Title,
    pinned,
    tags: tuple[CI_V3.TAGS] as Tag[],
  };

  const fav = tuple[CI_V3.FAV];
  if (fav !== null) {
    (data as { favicon?: FaviconUrl }).favicon = fav as FaviconUrl;
  }
  if (layout) {
    (data as { layout?: NodeData["layout"] }).layout = layout;
  }
  const lastVisitedAt = tuple[CI_V3.LAST_VISITED_AT];
  if (typeof lastVisitedAt === "number" && Number.isFinite(lastVisitedAt)) {
    (data as { lastVisitedAt?: Timestamp }).lastVisitedAt = lastVisitedAt as Timestamp;
  }
  const visitCount = tuple[CI_V3.VISIT_COUNT];
  if (typeof visitCount === "number" && Number.isFinite(visitCount) && visitCount > 0) {
    (data as { visitCount?: number }).visitCount = visitCount;
  }

  return {
    id: tuple[CI_V3.ID] as NodeId,
    timestamp: tuple[CI_V3.TS] as Timestamp,
    data,
    children: tuple[CI_V3.CHILDREN].map(tupleToNodeV3),
  };
}

function tupleToNodeV2(tuple: CompactNodeTupleV2): NavigationNodeJSON {
  const layout = parseLayout(tuple[CI_V2.LAYOUT]);
  const flags = tuple[CI_V2.FLAGS];
  const pinned = (flags & CF.PINNED) !== 0;

  const data: NodeData = {
    url: tuple[CI_V2.URL] as Url,
    title: tuple[CI_V2.TITLE] as Title,
    pinned,
    tags: tuple[CI_V2.TAGS] as Tag[],
  };

  const fav = tuple[CI_V2.FAV];
  if (fav !== null) {
    (data as { favicon?: FaviconUrl }).favicon = fav as FaviconUrl;
  }
  if (layout) {
    (data as { layout?: NodeData["layout"] }).layout = layout;
  }
  const lastVisitedAt = tuple[CI_V2.LAST_VISITED_AT];
  if (typeof lastVisitedAt === "number" && Number.isFinite(lastVisitedAt)) {
    (data as { lastVisitedAt?: Timestamp }).lastVisitedAt = lastVisitedAt as Timestamp;
  }

  return {
    id: tuple[CI_V2.ID] as NodeId,
    timestamp: tuple[CI_V2.TS] as Timestamp,
    data,
    children: tuple[CI_V2.CHILDREN].map(tupleToNodeV2),
  };
}

function tupleToNodeV1(tuple: CompactNodeTupleV1): NavigationNodeJSON {
  const layout = parseLayout(tuple[CI_V1.LAYOUT]);
  const flags = tuple[CI_V1.FLAGS];
  const pinned = (flags & CF.PINNED) !== 0;

  const data: NodeData = {
    url: tuple[CI_V1.URL] as Url,
    title: tuple[CI_V1.TITLE] as Title,
    pinned,
    tags: tuple[CI_V1.TAGS] as Tag[],
  };

  const fav = tuple[CI_V1.FAV];
  if (fav !== null) {
    (data as { favicon?: FaviconUrl }).favicon = fav as FaviconUrl;
  }
  if (layout) {
    (data as { layout?: NodeData["layout"] }).layout = layout;
  }

  return {
    id: tuple[CI_V1.ID] as NodeId,
    timestamp: tuple[CI_V1.TS] as Timestamp,
    data,
    children: tuple[CI_V1.CHILDREN].map(tupleToNodeV1),
  };
}
