/**
 * The "root is always New Tab" invariant.
 *
 * Every tree in Trail must have a root whose URL is a New-Tab page.
 * This is the one anchor that Ctrl+T / Cmd+T new tabs always collapse
 * into, so a tree can never "lose" the user's starting point. Any
 * real page the user visits is attached as a descendant of that root.
 *
 * This module is the single source of truth for:
 *   - what the canonical NTP root looks like (URL, title, NodeData)
 *   - how to recognise an NTP URL (the pattern list is shared)
 *   - how to synthesise a fresh root or wrap a non-NTP root
 *
 * Enforcement lives in two places:
 *   1. `NavigationTree.navigateUnder` (background/state/nav-tree.ts) —
 *      the runtime chokepoint every live root-creation path funnels
 *      through.
 *   2. `NavigationTreeMapper.fromJSON` (shared/lib/mapper.ts) — the
 *      deserialise-time guard that auto-repairs legacy or imported
 *      trees whose root is a real URL.
 *
 * Both paths use helpers from this file so the invariant is defined
 * in one place.
 */

import type { NodeData } from "../types/node.js";
import type { Url, Title } from "../types/ids.js";

/** Canonical URL used for synthesised New Tab roots. */
export const NEW_TAB_ROOT_URL = "chrome://newtab/" as Url;

/** Canonical title for a synthesised New Tab root. */
export const NEW_TAB_ROOT_TITLE = "New Tab" as Title;

/**
 * Patterns that identify a New-Tab / NTP page across Chrome, Chromium
 * forks, and extension-provided NTPs. A match means the URL is a
 * legitimate tree root.
 *
 * Kept in `shared/` so both the background navigation layer and the
 * shared mapper/import layer validate against the same list.
 * `background/utils/url-utils.ts` re-exports `isNewTabUrl` from here
 * for backward compatibility with existing call sites.
 */
const ntpUrlPatterns: ReadonlyArray<RegExp> = [
  /^(?<scheme>[a-z][a-z0-9+.-]*):\/\/(?<page>newtab|new-tab-page)\/?(?:[?#].*)?$/i,
  /^(?<scheme>chrome-search):\/\/(?<page>local-ntp|newtab)\/.*$/i,
  /^(?<scheme>chrome-extension):\/\/(?<extId>[a-p]{32})\/(?<path>(?:.*\/)?(?:newtab|new-tab-page|ntp)(?:\.html?)?)(?:[?#].*)?$/i,
  /^(?<scheme>brave-extension):\/\/(?<extId>[a-p]{32})\/(?<path>(?:.*\/)?(?:newtab|new-tab-page|ntp)(?:\.html?)?)(?:[?#].*)?$/i,
  /^about:blank(?:[#?].*)?$/i,
  /^about:newtab(?:[#?].*)?$/i,
  /^about:new-tab-page(?:[#?].*)?$/i,
  /^about:ntp(?:[#?].*)?$/i,
] as const;

/** True iff `url` matches any of the known New-Tab / NTP URL shapes. */
export function isNewTabUrl(url: Url | string): boolean {
  return ntpUrlPatterns.some((pattern) => pattern.test(url));
}

/**
 * Fresh `NodeData` for a synthesised New Tab root. A factory (not a
 * shared constant) because `NodeData.tags` is mutable — handing out
 * the same array to every caller would let one tree's edits bleed
 * into another's.
 */
export function buildNewTabRootData(): NodeData {
  return {
    url: NEW_TAB_ROOT_URL,
    title: NEW_TAB_ROOT_TITLE,
    pinned: false,
    tags: [],
  };
}
