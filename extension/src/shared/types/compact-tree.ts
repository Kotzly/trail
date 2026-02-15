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

/** Positional indices within a CompactNodeTuple. */
export const CI = {
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
 * [id, timestamp, url, title, favicon|null, flags, tags, layout|null, children[]]
 *
 * - flags: bitmask (bit 0 = pinned)
 * - layout: null | [offsetX, offsetY] | [offsetX, offsetY, angleDelta, radiusDelta]
 * - tags: string[] (tag IDs)
 */
export type CompactNodeTuple = [
  id: number,
  ts: number,
  url: string,
  title: string,
  fav: string | null,
  flags: number,
  tags: string[],
  layout: number[] | null,
  children: CompactNodeTuple[],
];

/**
 * Compact tree envelope.
 *
 * - v: format version (always 1 for now)
 * - r: root node tuple or null
 * - c: currentNodeId or null
 * - n: nodeCount
 */
export type CompactTreeJSON = {
  v: 1;
  r: CompactNodeTuple | null;
  c: number | null;
  n: number;
};
