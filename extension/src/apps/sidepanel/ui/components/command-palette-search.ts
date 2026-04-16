import type { NavigationTree } from "@background/state/nav-tree.js";
import type { NodeId } from "@shared/types/ids.js";

/**
 * Compact, score-ready record for a single tree node. Built once per
 * tree reference and consulted by `SearchIndex.search` on every
 * keystroke — keep it cheap.
 */
export type IndexEntry = {
  id: NodeId;
  title: string;
  url: string;
  favicon?: string;
  /** Lowercased "title\nurl" — pre-built so query matching never has to
   *  call `.toLowerCase()` on the corpus during typing. */
  haystack: string;
  /** Lowercased title alone, kept separate so we can detect title-prefix
   *  vs. substring vs. URL-only matches and weight them differently. */
  titleLower: string;
  freq: number;
  lastAt: number;
  /** Frequency + recency baseline. Combined into a single number at build
   *  time so the empty-query "default top" can be a pre-sorted slice. */
  baseScore: number;
};

const RECENCY_HALFLIFE_MS = 14 * 24 * 60 * 60 * 1000;

/** Number of items in the empty-query "recent & frequent" bucket. */
const DEFAULT_TOP = 20;

/** Match weighting. Title-prefix beats title-substring beats URL-only. */
const TITLE_PREFIX_BONUS = 4;
const TITLE_SUBSTR_BONUS = 2;
const URL_ONLY_BONUS = 0.5;

/**
 * In-memory search index over a `NavigationTree`. One instance per tree
 * reference: cheap to build (linear scan, ~few µs per node), reusable
 * across many keystrokes. No external library, no cap on corpus size.
 *
 * The empty-query default returns the top-N nodes by a single combined
 * `baseScore = log1p(visitCount) + exp-decay(now - lastVisitedAt)`. With
 * a query, every entry is rescanned with bonuses for title-prefix /
 * title-substring / url-only matches; partial sort returns the top K.
 */
export class SearchIndex {
  readonly entries: readonly IndexEntry[];
  /** Pre-sorted slice for empty-query default. Recency drift between
   *  build time and search time is negligible (14-day halflife means an
   *  hour of drift moves the score by ~0.3%). */
  readonly topByBase: readonly IndexEntry[];

  constructor(tree: NavigationTree, now: number = Date.now()) {
    this.entries = build(tree, now);
    this.topByBase = topK(this.entries, DEFAULT_TOP);
  }

  /** Returns up to `limit` matches for `query`, sorted by score desc.
   *  Empty query returns the pre-sorted `topByBase` slice. */
  search(query: string, limit: number): IndexEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.topByBase.slice(0, limit);
    return rank(this.entries, q, limit);
  }
}

function build(tree: NavigationTree, now: number): IndexEntry[] {
  const entries: IndexEntry[] = [];
  for (const node of tree.iter()) {
    const title = String(node.data.title ?? node.data.url ?? "Untitled");
    const url = String(node.data.url ?? "");
    const titleLower = title.toLowerCase();
    const freq = typeof node.data.visitCount === "number" ? node.data.visitCount : 0;
    const lastAt = typeof node.data.lastVisitedAt === "number" ? node.data.lastVisitedAt : 0;
    entries.push({
      id: node.id,
      title,
      url,
      favicon: node.data.favicon ? String(node.data.favicon) : undefined,
      haystack: `${titleLower}\n${url.toLowerCase()}`,
      titleLower,
      freq,
      lastAt,
      baseScore: Math.log1p(freq) + recencyScore(lastAt, now),
    });
  }
  return entries;
}

function recencyScore(lastAt: number, now: number): number {
  if (!lastAt) return 0;
  const age = Math.max(0, now - lastAt);
  return Math.exp(-age / RECENCY_HALFLIFE_MS);
}

/** Plain sort + slice. Faster than a heap up to ~100k entries because
 *  V8's TimSort is cache-friendly on contiguous arrays. Swap for a
 *  bounded min-heap if the corpus ever grows past that. */
function topK(entries: readonly IndexEntry[], k: number): IndexEntry[] {
  return [...entries].sort((a, b) => b.baseScore - a.baseScore).slice(0, k);
}

function rank(entries: readonly IndexEntry[], q: string, limit: number): IndexEntry[] {
  type Hit = { entry: IndexEntry; score: number };
  const hits: Hit[] = [];
  for (const entry of entries) {
    if (!entry.haystack.includes(q)) continue;
    const titleIdx = entry.titleLower.indexOf(q);
    let bonus: number;
    if (titleIdx === 0) bonus = TITLE_PREFIX_BONUS;
    else if (titleIdx > 0) bonus = TITLE_SUBSTR_BONUS;
    else bonus = URL_ONLY_BONUS;
    hits.push({ entry, score: entry.baseScore + bonus });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map((h) => h.entry);
}
