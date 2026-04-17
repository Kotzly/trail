/**
 * Cleanup policy — applies the Layer 3a glance decisions made by
 * `nav-pattern-tracker` to the tree.
 *
 * Keeps policy out of `navigation-handler` so the handler stays about
 * "commit webnav → mutate tree" and prune/revive decisions live here.
 *
 * Design notes:
 * - Prune is always silent. No toasts, no notifications.
 * - Tombstones are best-effort. A failed write means the node is
 *   gone but the user can't revive via return-to-URL — not a
 *   correctness issue.
 * - Runs under `withTreeLock` so the prune is atomic wrt other
 *   mutations. Callers (the tracker event consumer) must NOT hold
 *   the lock when invoking — this function acquires it.
 */

import type { NodeId, Title, Url } from "@shared/types/ids.js";
import type { NodeData } from "@shared/types/node.js";
import { treeStorage, withTreeLock } from "./tree-storage.js";
import { tabManager } from "../state/tab-manager.js";
import { recordTombstone, findTombstoneByUrl } from "./cleanup-tombstones.js";
import { settingsManager } from "./settings.js";
import { createLogger } from "@shared/lib/logger.js";

const log = createLogger("cleanup-policy");

/**
 * Apply the glance-prune rule to a node. Silent delete if all of:
 *   - the node is still in the tree
 *   - it has no children (subtree preservation)
 *   - visitCount ≤ 1 (single-visit — revisited nodes are kept)
 *   - no other tab is currently mapped to it
 *
 * Returns true when the node was pruned, false otherwise.
 */
export async function pruneGlance(nodeId: NodeId): Promise<boolean> {
  // Gate on the feature being enabled.
  const cleanup = settingsManager.get().cleanup;
  if (!cleanup || cleanup.glance?.enabled === false) return false;

  return withTreeLock(async () => {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(nodeId);
    if (!node) return false;
    if (node.isRoot()) return false;

    const children = node.getChildren();
    if (children.length > 0) return false;

    const visitCount = node.data.visitCount ?? 1;
    if (visitCount > 1) return false;

    // Domain allowlist — respect user's per-domain opt-out.
    const host = tryGetHost(node.data.url);
    if (host && cleanup.allowDomains?.some((d: string) => domainMatches(host, d))) {
      return false;
    }

    // Another tab still attached — not a safe prune target.
    const mappedTabs = tabManager.tabsByNode(nodeId);
    if (mappedTabs.size > 0) return false;

    // Record tombstone BEFORE the delete so the revival path has data.
    try {
      await recordTombstone(node, "glance");
    } catch (error) {
      log.warn("tombstone record failed (pruning anyway)", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    tree.deleteNode(nodeId);
    treeStorage.cacheTree(tree);
    return true;
  });
}

/**
 * Revival path: if a URL has a live tombstone, recreate the node at
 * its original parent (or current tree root if the parent is gone).
 * Returns the re-created NodeId or null if no revival happened.
 *
 * Called from navigation-handler when a fresh nav URL matches a
 * tombstone — the user returned to a pruned page.
 */
export async function reviveFromTombstone(
  url: Url,
): Promise<{ nodeId: NodeId; parentId: NodeId | null } | null> {
  const tombstone = await findTombstoneByUrl(url as string);
  if (!tombstone) return null;

  return withTreeLock(async () => {
    const tree = await treeStorage.getOrCreateTree();
    // If a live node for this URL already exists (race or concurrent
    // revival), don't duplicate — just drop the tombstone.
    const existing = tree.findByUrl(url);
    if (existing) {
      const { consumeTombstoneById } = await import("./cleanup-tombstones.js");
      await consumeTombstoneById(tombstone.nodeId);
      return { nodeId: existing.id, parentId: existing.getParent()?.id ?? null };
    }

    const parentNode = tombstone.parentId ? tree.findNodeById(tombstone.parentId as NodeId) : null;
    const parentId = parentNode ? parentNode.id : (tree.getRoot()?.id ?? null);

    const data: NodeData = {
      url: tombstone.url as Url,
      title: tombstone.title as Title,
      ...(tombstone.favicon ? { favicon: tombstone.favicon as NodeData["favicon"] } : {}),
      pinned: false,
      tags: [],
    } as NodeData;

    const revived = tree.navigateUnder(parentId, data, { setAsCurrent: false });
    treeStorage.cacheTree(tree);
    const { consumeTombstoneById } = await import("./cleanup-tombstones.js");
    await consumeTombstoneById(tombstone.nodeId);
    return { nodeId: revived.id, parentId };
  });
}

function tryGetHost(url: string): string | null {
  try {
    return new URL(url).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function domainMatches(host: string, pattern: string): boolean {
  const p = pattern.toLowerCase().replace(/^www\./, "");
  if (p === host) return true;
  if (p.startsWith("*.")) {
    const suffix = p.slice(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  return false;
}
