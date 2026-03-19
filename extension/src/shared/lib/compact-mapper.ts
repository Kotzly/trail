/**
 * Lossless conversion between NavigationTreeJSON and CompactTreeJSON.
 *
 * Round-trip guarantee: fromCompact(toCompact(tree)) deep-equals tree.
 */

import type { NodeId, Timestamp, Url, Title, FaviconUrl, Tag } from "../types/ids.js";
import type { NodeData, NavigationNodeJSON } from "../types/node.js";
import type { NavigationTreeJSON } from "../types/tree.js";
import {
  CI,
  CI_V1,
  CI_V2,
  CF,
  type CompactNodeTupleV1,
  type CompactNodeTupleV2,
  type CompactNodeTupleV3,
  type CompactTreeJSON,
  type CompactTreeJSONV3,
} from "../types/compact-tree.js";

// ---------------------------------------------------------------------------
// Tree-level conversion
// ---------------------------------------------------------------------------

export function toCompact(tree: NavigationTreeJSON): CompactTreeJSON {
  return {
    v: 3,
    r: tree.root ? nodeToTuple(tree.root) : null,
    c: tree.currentNodeId as number | null,
    n: tree.nodeCount,
  } as CompactTreeJSONV3;
}

export function fromCompact(compact: CompactTreeJSON): NavigationTreeJSON {
  if (compact.v === 1) {
    return {
      root: compact.r ? tupleToNodeV1(compact.r) : null,
      currentNodeId: compact.c as NodeId | null,
      nodeCount: compact.n,
    };
  }

  if (compact.v === 2) {
    return {
      root: compact.r ? tupleToNodeV2(compact.r) : null,
      currentNodeId: compact.c as NodeId | null,
      nodeCount: compact.n,
    };
  }

  return {
    root: compact.r ? tupleToNodeV3(compact.r) : null,
    currentNodeId: compact.c as NodeId | null,
    nodeCount: compact.n,
  };
}

// ---------------------------------------------------------------------------
// Node-level conversion
// ---------------------------------------------------------------------------

function nodeToTuple(node: NavigationNodeJSON): CompactNodeTupleV3 {
  const d = node.data;
  const flags = d.pinned ? CF.PINNED : 0;

  let layout: number[] | null = null;
  if (d.layout) {
    if (d.layout.radial) {
      layout = [
        d.layout.offsetX,
        d.layout.offsetY,
        d.layout.radial.angleDelta,
        d.layout.radial.radiusDelta,
      ];
    } else {
      layout = [d.layout.offsetX, d.layout.offsetY];
    }
  }

  return [
    node.id as number,
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
    node.children.map(nodeToTuple),
  ];
}

function parseLayout(layoutArr: number[] | null): NodeData["layout"] | undefined {
  if (!layoutArr) return undefined;
  const base = { offsetX: layoutArr[0]!, offsetY: layoutArr[1]! };
  if (layoutArr.length >= 4) {
    return { ...base, radial: { angleDelta: layoutArr[2]!, radiusDelta: layoutArr[3]! } };
  }
  return base;
}

function tupleToNodeV3(tuple: CompactNodeTupleV3): NavigationNodeJSON {
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

  return {
    id: tuple[CI.ID] as NodeId,
    timestamp: tuple[CI.TS] as Timestamp,
    data,
    children: tuple[CI.CHILDREN].map(tupleToNodeV3),
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
