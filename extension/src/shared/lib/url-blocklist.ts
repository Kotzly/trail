/**
 * Shared URL pattern matcher. Used by:
 *   - the navigation handler to short-circuit `shouldTrackUrl`,
 *   - the Privacy settings UI for previewing which URLs would be skipped,
 *   - the graph fold transform for auto-collapsing repetitive nav chains.
 *
 * Patterns match against the URL's **hostname + pathname**, split into
 * `/`-separated segments. Case-insensitive. Query string and fragment
 * are ignored; port is dropped.
 *
 * ## Syntax
 *
 *   - Plain chars       match literally (regex metacharacters escaped)
 *   - `*`               matches any chars within a single segment (no `/`)
 *   - `**`              matches zero or more full segments (crosses `/`);
 *                       only treated as globstar when it's a whole segment
 *                       (surrounded by `/` or string boundaries), otherwise
 *                       falls back to a pair of `*`
 *   - Patterns without `/` test each URL segment individually; matching
 *     any one segment wins.
 *   - Patterns with `/` are matched positionally from the start of the
 *     joined URL (hostname + path).
 *
 * Segments = lowercased `hostname + pathname`, split on `/`, empties
 * dropped:
 *   https://Example.COM/a/b/       → ["example.com", "a", "b"]
 *   https://translate.COM/?foo=bar → ["translate.com"]
 *
 * ## Examples
 *
 *   localhost         any segment equal to "localhost" (normally a hostname)
 *   *.bank.com        any segment ending in `.bank.com`
 *   *banking*         any segment containing "banking" (hostname OR path)
 *   *translate*       any segment containing "translate" — matches
 *                     `translate.com`, `translate.example.com`,
 *                     `anything.com/translate`, `deepl.com/translator`
 *   * /translate      URL with exactly two segments, second is "translate"
 *                     (matches `example.com/translate`, NOT `example.com/ru/translate`)
 *   ** /translate     URL ending in a `translate` segment at any depth
 *                     (matches `example.com/translate`, `a/b/c/translate`,
 *                     NOT `translate.com`)
 *   example.com/**    any URL under `example.com`
 *   *                 matches any URL (any single segment)
 *   **                matches any URL
 */

export type UrlPredicate = (url: string) => boolean;

const REGEX_METACHARS = /[.+?^${}()|[\]\\]/g;

function escapeLiteral(s: string): string {
  return s.replace(REGEX_METACHARS, "\\$&");
}

/** Compile `*foo*bar*` (single segment, no `/`, no globstar) to a regex
 * anchored to a full segment. */
function compileSegmentGlob(pattern: string): RegExp {
  const source = escapeLiteral(pattern).replace(/\*/g, "[^/]*");
  return new RegExp(`^${source}$`, "i");
}

// Compile a pattern containing `/` (possibly with `**`) to a regex
// anchored to the joined URL string.
//
// Globstar handling:
//   - bare globstar (the whole pattern is `**`) → `.*`
//   - leading globstar before a slash           → `(?:[^/]+/)*`
//   - trailing globstar after a slash           → `(?:/[^/]+)*`
//   - middle globstar between slashes           → `(?:/[^/]+)*/`
//   - globstar not at a segment boundary (e.g. `foo**` or `**foo`) is
//     treated as two single stars, i.e. `[^/]*`. Rare but well-defined.
function compilePathGlob(pattern: string): RegExp {
  let source = "";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i]!;
    if (c === "*" && pattern[i + 1] === "*") {
      const prevOk = i === 0 || pattern[i - 1] === "/";
      const nextOk = i + 2 === pattern.length || pattern[i + 2] === "/";
      if (prevOk && nextOk) {
        if (i === 0 && i + 2 === pattern.length) {
          // Bare `**` (the entire pattern)
          source += ".*";
          i += 2;
          continue;
        }
        if (i === 0) {
          // Leading `**/` — zero or more `segment/`
          source += "(?:[^/]+/)*";
          i += 3;
          continue;
        }
        if (i + 2 === pattern.length) {
          // Trailing `/**` — zero or more `/segment`
          if (source.endsWith("/")) source = source.slice(0, -1);
          source += "(?:/[^/]+)*";
          i += 2;
          continue;
        }
        // Middle `/**/` — zero or more `/segment` then `/`
        if (source.endsWith("/")) source = source.slice(0, -1);
        source += "(?:/[^/]+)*/";
        i += 3;
        continue;
      }
      // Not at a segment boundary — treat as two single stars.
      source += "[^/]*";
      i += 2;
      continue;
    }
    if (c === "*") {
      source += "[^/]*";
      i += 1;
      continue;
    }
    if (c === "/") {
      source += "/";
      i += 1;
      continue;
    }
    source += escapeLiteral(c);
    i += 1;
  }
  return new RegExp(`^${source}$`, "i");
}

type CompiledPattern = (segments: readonly string[]) => boolean;

function compilePattern(pattern: string): CompiledPattern | null {
  const trimmed = pattern.trim().toLowerCase();
  if (trimmed.length === 0) return null;

  if (!trimmed.includes("/")) {
    const re = compileSegmentGlob(trimmed);
    return (segments) => segments.some((s) => re.test(s));
  }

  const re = compilePathGlob(trimmed);
  return (segments) => re.test(segments.join("/"));
}

function urlToSegments(url: string): readonly string[] | null {
  try {
    const u = new URL(url);
    const combined = u.hostname.toLowerCase() + u.pathname.toLowerCase();
    return combined.split("/").filter((s) => s.length > 0);
  } catch {
    return null;
  }
}

/**
 * Insertion-ordered LRU. On `get`, the entry is re-inserted to mark
 * it as most-recently-used. On `set` overflow, the oldest entry
 * (the first key returned by `Map.prototype.keys()`) is evicted.
 */
class LRU<K, V> {
  private readonly map = new Map<K, V>();
  constructor(private readonly max: number) {}
  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.max) {
      const firstKey = this.map.keys().next().value as K | undefined;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, value);
  }
  get size(): number {
    return this.map.size;
  }
}

/** Test-only inspection hook attached to predicates returned by
 * `compileBlocklist`. Reads the per-predicate URL→bool memo size. */
const MEMO_SIZE_SYMBOL: unique symbol = Symbol("urlMemoSize");

/**
 * Predicate-level cache, keyed by the joined pattern list. Without
 * it, every `useGraphLayout` recompute (one per `TREE_UPDATED` —
 * dozens per minute of normal use) builds a fresh matcher closure
 * AND walks ~N URLs through `urlToSegments` from scratch. The walk
 * is `computeChainFoldInfo` calling `matches(url)` for every node;
 * each call allocates a `URL` object, a lowercased concat, and two
 * arrays from split/filter. On a 1800-node tree that's ~7k
 * short-lived allocations per render → 50ms of V8.GC_SCAVENGER per
 * 80–100ms reconcile task, traced in DevTools.
 *
 * Caching the predicate by `patterns.join("\n")` returns the same
 * closure (and its inner URL→bool map) every time the user's
 * collapselist content is unchanged, even when React passes a new
 * array reference. `\n` is just a cache-key separator — it isn't
 * part of the matcher syntax and never appears in trimmed patterns.
 *
 * Bounded: each entry holds a closure + a URL memo, so a runaway
 * caller (e.g. ad-hoc programmatic compilation of many distinct
 * pattern lists) cannot accumulate unboundedly in the long-lived
 * background context. 50 entries is plenty — one per unique
 * blocklist version in flight.
 */
const PREDICATE_CACHE_MAX = 50;
const predicateCache = new LRU<string, UrlPredicate>(PREDICATE_CACHE_MAX);

/** Per-predicate URL→bool memo cap. The extension matches every
 * navigation, so without a bound this would grow forever in the
 * background. 200 entries comfortably covers the working set of
 * recently-visited URLs while keeping the predicate cheap. */
const URL_MEMO_MAX = 200;

/**
 * Compile a list of patterns into a single URL predicate.
 *
 * Empty strings are ignored. An empty list returns `false` for every
 * URL. Patterns are tested in order; any match short-circuits to true.
 */
export function compileBlocklist(patterns: readonly string[]): UrlPredicate {
  const cacheKey = patterns.join("\n");
  const cached = predicateCache.get(cacheKey);
  if (cached) return cached;

  const matchers: CompiledPattern[] = [];
  for (const p of patterns) {
    const m = compilePattern(p);
    if (m) matchers.push(m);
  }

  let predicate: UrlPredicate;
  let urlMemo: LRU<string, boolean> | null = null;
  if (matchers.length === 0) {
    predicate = () => false;
  } else {
    // Per-predicate URL→bool memo. Lives for the life of this matcher
    // (i.e. as long as the same collapselist content is in use). On a
    // tree with N nodes but K unique URLs (K ≪ N typically — multiple
    // node visits share a URL), this collapses ~N work per render
    // into K work on the very first render and 0 work thereafter.
    // Bounded LRU — see `URL_MEMO_MAX`.
    urlMemo = new LRU<string, boolean>(URL_MEMO_MAX);
    const memo = urlMemo;
    predicate = (url: string) => {
      const memoed = memo.get(url);
      if (memoed !== undefined) return memoed;
      const segments = urlToSegments(url);
      const result = segments !== null && matchers.some((m) => m(segments));
      memo.set(url, result);
      return result;
    };
  }

  // Non-enumerable test-only hook for asserting cache bounds.
  Object.defineProperty(predicate, MEMO_SIZE_SYMBOL, {
    value: () => urlMemo?.size ?? 0,
    enumerable: false,
  });

  predicateCache.set(cacheKey, predicate);
  return predicate;
}

/** Test-only: read the URL→bool memo size for a predicate returned
 * by `compileBlocklist`. Returns 0 for predicates with no matchers. */
export function __getUrlMemoSizeForTests(predicate: UrlPredicate): number {
  const sizer = (predicate as unknown as Record<symbol, () => number>)[MEMO_SIZE_SYMBOL];
  return typeof sizer === "function" ? sizer() : 0;
}

/**
 * Semantic alias for the chain-fold feature: same matcher as the
 * blocklist, but collapselist patterns don't block anything — they mark
 * navigations as visually foldable in the graph transform.
 */
export const compileCollapselist = compileBlocklist;
