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
 * Compile a list of patterns into a single URL predicate.
 *
 * Empty strings are ignored. An empty list returns `false` for every
 * URL. Patterns are tested in order; any match short-circuits to true.
 */
export function compileBlocklist(patterns: readonly string[]): UrlPredicate {
  const matchers: CompiledPattern[] = [];
  for (const p of patterns) {
    const m = compilePattern(p);
    if (m) matchers.push(m);
  }
  if (matchers.length === 0) return () => false;
  return (url: string) => {
    const segments = urlToSegments(url);
    if (!segments) return false;
    return matchers.some((m) => m(segments));
  };
}

/**
 * Semantic alias for the chain-fold feature: same matcher as the
 * blocklist, but collapselist patterns don't block anything — they mark
 * navigations as visually foldable in the graph transform.
 */
export const compileCollapselist = compileBlocklist;
