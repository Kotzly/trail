import MiniSearch from "minisearch";
import { iter, type TreeIndex } from "../state/tree-index.js";
import type { NodeId } from "@shared/types/ids.js";

export type IndexEntry = {
  id: NodeId;
  title: string;
  url: string;
  favicon?: string;
  freq: number;
  lastAt: number;
  baseScore: number;
};

const RECENCY_HALFLIFE_MS = 14 * 24 * 60 * 60 * 1000;

/** Number of items in the empty-query "recent & frequent" bucket. */
const DEFAULT_TOP = 20;

/**
 * Command-palette search over a TreeIndex. MiniSearch handles the text
 * matching (prefix, fuzzy, title boost); a per-entry baseScore (visit
 * frequency + exp-decay recency) is added on top so that two
 * equally-matched entries rank by usage. Empty queries skip MiniSearch
 * entirely and return a precomputed top-N by baseScore.
 */
export class SearchIndex {
  private readonly entries: ReadonlyMap<NodeId, IndexEntry>;
  private readonly mini: MiniSearch<IndexEntry>;
  readonly topByBase: readonly IndexEntry[];

  constructor(idx: TreeIndex, now: number = Date.now()) {
    const entries = build(idx, now);
    this.entries = new Map(entries.map((e) => [e.id, e]));
    this.topByBase = topK(entries, DEFAULT_TOP);

    this.mini = new MiniSearch<IndexEntry>({
      fields: ["title", "url"],
      storeFields: ["id"],
      idField: "id",
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: { title: 3, url: 1 },
      },
    });
    this.mini.addAll(entries);
  }

  search(query: string, limit: number): IndexEntry[] {
    const q = query.trim();
    if (!q) return this.topByBase.slice(0, limit);

    const results = this.mini.search(q, {
      boostDocument: (id) => {
        const entry = this.entries.get(id as NodeId);
        return entry ? 1 + entry.baseScore : 1;
      },
    });

    const out: IndexEntry[] = [];
    for (const hit of results) {
      const entry = this.entries.get(hit.id as NodeId);
      if (entry) out.push(entry);
      if (out.length >= limit) break;
    }
    return out;
  }
}

function build(idx: TreeIndex, now: number): IndexEntry[] {
  const entries: IndexEntry[] = [];
  for (const node of iter(idx)) {
    const title = String(node.data.title ?? node.data.url ?? "Untitled");
    const url = String(node.data.url ?? "");
    const freq = typeof node.data.visitCount === "number" ? node.data.visitCount : 0;
    const lastAt = typeof node.data.lastVisitedAt === "number" ? node.data.lastVisitedAt : 0;
    entries.push({
      id: node.id,
      title,
      url,
      favicon: node.data.favicon ? String(node.data.favicon) : undefined,
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

function topK(entries: readonly IndexEntry[], k: number): IndexEntry[] {
  return [...entries].sort((a, b) => b.baseScore - a.baseScore).slice(0, k);
}
