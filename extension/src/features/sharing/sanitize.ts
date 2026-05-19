import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { NavigationNodeJSON, NodeData } from "@shared/types/node.js";

/**
 * Client-side snapshot sanitization for the share-link feature.
 *
 * Run on the snapshot before calling `create_share_link`. The premortem
 * flagged URL-fragment / token-param leakage and bidi-override unicode
 * in titles as the highest-likelihood privacy regression. We do the
 * cleanup here, in TypeScript, so the user sees what's redacted before
 * the snapshot reaches the wire.
 *
 * Server enforces structural caps (2 MB / 10 000 nodes) as a defensive
 * layer in case a different client bypasses this code path. See
 * `supabase/migrations/019_share_rpcs.sql`.
 */

/**
 * Strip URL fragment and query string from every URL. Fragments
 * sometimes carry session tokens (OAuth implicit flow, password-reset
 * stubs); query strings often carry `?token=`, `?session=`,
 * `?access_token=`. v1 strips them all — the host + path is enough
 * to identify a page for browsing-history context. A future v2 may
 * relax this for an allowlist of hosts where query is meaningful (e.g.
 * Google search pages).
 */
export function sanitizeUrl(input: string): string {
  if (!input) return "";
  try {
    const url = new URL(input);
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * Strip unicode bidirectional-override codepoints (U+202A–U+202E,
 * U+2066–U+2069). These are the classic vector for "title appears as
 * `safe.txt` but is actually `txt.exe.bat`". React's JSX escaping
 * doesn't help here — the codepoints are valid text. Truncate to 256
 * characters to bound the size and prevent UI blowouts on the viewer.
 */
const BIDI_OVERRIDES = /[‪-‮⁦-⁩]/g;
const MAX_TITLE_LENGTH = 256;

export function sanitizeTitle(input: string): string {
  if (!input) return "";
  const stripped = input.replace(BIDI_OVERRIDES, "");
  return stripped.length > MAX_TITLE_LENGTH ? stripped.slice(0, MAX_TITLE_LENGTH) : stripped;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
function roundToDay(timestamp: number): number {
  return Math.floor(timestamp / ONE_DAY_MS) * ONE_DAY_MS;
}

/**
 * Sanitize `NodeData`. Drops favicon (hotlinking is a tracker-pixel
 * vector and chrome:// favicons 404 in a normal browser anyway —
 * premortem #14.1), drops layout offsets (user-specific viewport
 * positions, not meaningful in the public viewer), drops visitCount
 * (browsing-frequency leak), rounds timestamps to day granularity.
 */
function sanitizeNodeData(data: NodeData): NodeData {
  const url = sanitizeUrl(data.url as unknown as string);
  const title = sanitizeTitle(data.title as unknown as string);
  // Cast through unknown to satisfy the branded string types in NodeData
  // without re-declaring constructors here.
  return {
    url: url as unknown as NodeData["url"],
    title: title as unknown as NodeData["title"],
    pinned: data.pinned,
    tags: Array.isArray(data.tags) ? [...data.tags] : [],
    // Intentionally dropped: favicon, layout, layoutUpdatedAt,
    // pinnedUpdatedAt, lastVisitedAt, visitCount.
  } as NodeData;
}

function sanitizeNode(node: NavigationNodeJSON): NavigationNodeJSON {
  return {
    id: node.id,
    timestamp: roundToDay(node.timestamp as unknown as number) as NavigationNodeJSON["timestamp"],
    data: sanitizeNodeData(node.data),
    children: node.children.map(sanitizeNode),
  };
}

/**
 * Run the snapshot sanitizer over a tree. Returns a deep-cloned tree
 * suitable for `create_share_link`. The caller's local tree is
 * unaffected.
 */
export function sanitizeTreeForShare(tree: NavigationTreeJSON): NavigationTreeJSON {
  return {
    root: tree.root ? sanitizeNode(tree.root) : null,
    // Don't leak "where the owner is currently looking".
    currentNodeId: null,
    nodeCount: tree.nodeCount,
  };
}
