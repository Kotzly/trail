/**
 * Compact tuple-based tree format for storage.
 *
 * Each NavigationNodeJSON (keyed object ~150 bytes of key names per node) is
 * flattened into a positional tuple, eliminating all repeated property names.
 * Combined with gzip this achieves ~90% size reduction vs verbose JSON.
 *
 * Format version is embedded in CompactTreeJSON.v so we can migrate later.
 */

// ---------------------------------------------------------------------------
// Tuple position indices (named for readability)
// ---------------------------------------------------------------------------

/** Positional indices within a CompactNodeTuple (current = V3). */
export const CI = {
  ID: 0,
  TS: 1,
  URL: 2,
  TITLE: 3,
  FAV: 4,
  FLAGS: 5,
  TAGS: 6,
  LAYOUT: 7,
  LAST_VISITED_AT: 8,
  VISIT_COUNT: 9,
  CHILDREN: 10,
} as const;

/** V2 tuple indices (no visitCount). */
export const CI_V2 = {
  ID: 0,
  TS: 1,
  URL: 2,
  TITLE: 3,
  FAV: 4,
  FLAGS: 5,
  TAGS: 6,
  LAYOUT: 7,
  LAST_VISITED_AT: 8,
  CHILDREN: 9,
} as const;

/** Legacy v1 tuple indices kept for backwards compatibility. */
export const CI_V1 = {
  ID: 0,
  TS: 1,
  URL: 2,
  TITLE: 3,
  FAV: 4,
  FLAGS: 5,
  TAGS: 6,
  LAYOUT: 7,
  CHILDREN: 8,
} as const;

/** Flag bitmask values. */
export const CF = {
  PINNED: 1,
} as const;

// ---------------------------------------------------------------------------
// Compact types
// ---------------------------------------------------------------------------

/**
 * Node represented as a positional tuple.
 *
 * V1:
 * [id, timestamp, url, title, favicon|null, flags, tags, layout|null, children[]]
 *
 * V2:
 * [id, timestamp, url, title, favicon|null, flags, tags, layout|null, lastVisitedAt|null, children[]]
 *
 * V3:
 * [id, timestamp, url, title, favicon|null, flags, tags, layout|null, lastVisitedAt|null, visitCount|null, children[]]
 *
 * - flags: bitmask (bit 0 = pinned)
 * - layout: null | [offsetX, offsetY]
 * - tags: string[] (tag IDs)
 * - lastVisitedAt: unix ms timestamp or null
 * - visitCount: number of visits or null
 */
// NOTE: id width is `string | number` for backward compatibility.
// Before schema v2 (Phase 0), all ids were numeric. After migration,
// all writes are strings (uuidv7 or stringified legacy numeric). The
// decoder (tupleToNodeV*) coerces via String() so consumers see a
// consistent NodeId (Brand<string, "NodeId">).
export type CompactNodeTupleV1 = [
  id: string | number,
  ts: number,
  url: string,
  title: string,
  fav: string | null,
  flags: number,
  tags: string[],
  layout: number[] | null,
  children: CompactNodeTupleV1[],
];

export type CompactNodeTupleV2 = [
  id: string | number,
  ts: number,
  url: string,
  title: string,
  fav: string | null,
  flags: number,
  tags: string[],
  layout: number[] | null,
  lastVisitedAt: number | null,
  children: CompactNodeTupleV2[],
];

export type CompactNodeTupleV3 = [
  id: string | number,
  ts: number,
  url: string,
  title: string,
  fav: string | null,
  flags: number,
  tags: string[],
  layout: number[] | null,
  lastVisitedAt: number | null,
  visitCount: number | null,
  children: CompactNodeTupleV3[],
];

export type CompactNodeTuple = CompactNodeTupleV1 | CompactNodeTupleV2 | CompactNodeTupleV3;

/**
 * Compact tree envelope.
 *
 * - v: format version
 * - r: root node tuple or null
 * - c: currentNodeId or null
 * - n: nodeCount
 */
export type CompactTreeJSONV1 = {
  v: 1;
  r: CompactNodeTupleV1 | null;
  c: string | number | null;
  n: number;
};

export type CompactTreeJSONV2 = {
  v: 2;
  r: CompactNodeTupleV2 | null;
  c: string | number | null;
  n: number;
};

export type CompactTreeJSONV3 = {
  v: 3;
  r: CompactNodeTupleV3 | null;
  c: string | number | null;
  n: number;
};

export type CompactTreeJSON = CompactTreeJSONV1 | CompactTreeJSONV2 | CompactTreeJSONV3;
