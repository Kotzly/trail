/**
 * Lossless conversion between NavigationTreeJSON and CompactTreeJSON.
 *
 * Round-trip guarantee: fromCompact(toCompact(tree)) deep-equals tree.
 */

import type { NodeId, Timestamp, Url, Title, FaviconUrl, Tag } from '../types/ids.js';
import type { NodeData, NavigationNodeJSON } from '../types/node.js';
import type { NavigationTreeJSON } from '../types/tree.js';
import { CI, CF, type CompactNodeTuple, type CompactTreeJSON } from '../types/compact-tree.js';

// ---------------------------------------------------------------------------
// Tree-level conversion
// ---------------------------------------------------------------------------

export function toCompact(tree: NavigationTreeJSON): CompactTreeJSON {
  return {
    v: 1,
    r: tree.root ? nodeToTuple(tree.root) : null,
    c: tree.currentNodeId as number | null,
    n: tree.nodeCount,
  };
}

export function fromCompact(compact: CompactTreeJSON): NavigationTreeJSON {
  return {
    root: compact.r ? tupleToNode(compact.r) : null,
    currentNodeId: compact.c as NodeId | null,
    nodeCount: compact.n,
  };
}

// ---------------------------------------------------------------------------
// Node-level conversion
// ---------------------------------------------------------------------------

function nodeToTuple(node: NavigationNodeJSON): CompactNodeTuple {
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
    node.children.map(nodeToTuple),
  ];
}

function tupleToNode(tuple: CompactNodeTuple): NavigationNodeJSON {
  const layoutArr = tuple[CI.LAYOUT];
  let layout: NodeData['layout'] | undefined;

  if (layoutArr) {
    const base = { offsetX: layoutArr[0]!, offsetY: layoutArr[1]! };
    if (layoutArr.length >= 4) {
      layout = { ...base, radial: { angleDelta: layoutArr[2]!, radiusDelta: layoutArr[3]! } };
    } else {
      layout = base;
    }
  }

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
    (data as { layout?: NodeData['layout'] }).layout = layout;
  }

  return {
    id: tuple[CI.ID] as NodeId,
    timestamp: tuple[CI.TS] as Timestamp,
    data,
    children: tuple[CI.CHILDREN].map(tupleToNode),
  };
}
