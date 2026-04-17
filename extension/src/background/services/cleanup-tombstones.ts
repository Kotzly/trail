/**
 * Cleanup tombstone store.
 *
 * When the auto-cleanup layers (glance prune, burst consolidation,
 * round-trip detection) silently remove a node, we record a
 * tombstone so the user can (a) rescue it by returning to the URL
 * within the TTL, or (b) audit/restore via the Recently cleaned
 * drawer.
 *
 * Store: chrome.storage.local under `trail_cleanup_tombstones`.
 * Lifetime: 72 hours from removal (TOMBSTONE_TTL_MS).
 * Eviction: lazy — on every write and on every drawer open.
 */

import {
  cleanupTombstonesItem,
  type CleanupTombstone,
  type CleanupReason,
} from "@shared/config/storage-items.js";
import { createUrlKey } from "@shared/lib/url-key.js";
import { createLogger } from "@shared/lib/logger.js";
import type { NavigationNode } from "@shared/types/node.js";

const log = createLogger("cleanup-tombstones");

export const TOMBSTONE_TTL_MS = 72 * 60 * 60 * 1000;
/** Bound on how many tombstones we keep regardless of TTL. */
const MAX_TOMBSTONES = 1000;

function dropExpired(tombstones: CleanupTombstone[], now: number): CleanupTombstone[] {
  const cutoff = now - TOMBSTONE_TTL_MS;
  return tombstones.filter((t) => t.removedAt > cutoff);
}

async function readAll(): Promise<CleanupTombstone[]> {
  try {
    return (await cleanupTombstonesItem.getValue()) ?? [];
  } catch (error) {
    log.warn("read failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function writeAll(tombstones: CleanupTombstone[]): Promise<void> {
  try {
    await cleanupTombstonesItem.setValue(tombstones);
  } catch (error) {
    log.warn("write failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function recordTombstone(node: NavigationNode, reason: CleanupReason): Promise<void> {
  const parent = node.getParent?.();
  const tombstone: CleanupTombstone = {
    nodeId: node.id as string,
    url: node.data.url as string,
    title: node.data.title as string,
    favicon: (node.data.favicon as string | undefined) ?? null,
    parentId: parent ? (parent.id as string) : null,
    removedAt: Date.now(),
    reason,
  };
  const now = Date.now();
  const fresh = dropExpired(await readAll(), now);
  fresh.push(tombstone);
  // Bound on size — drop oldest if we exceed the cap.
  const trimmed = fresh.length > MAX_TOMBSTONES ? fresh.slice(-MAX_TOMBSTONES) : fresh;
  await writeAll(trimmed);
}

/**
 * Look up a tombstone by URL key. Used by navigation-handler to
 * detect "user returned to a pruned URL → revive the node."
 * Returns the tombstone without removing it — the caller decides.
 */
export async function findTombstoneByUrl(url: string): Promise<CleanupTombstone | undefined> {
  const now = Date.now();
  const fresh = dropExpired(await readAll(), now);
  const key = createUrlKey(url);
  return fresh.find((t) => createUrlKey(t.url) === key);
}

/**
 * Remove a tombstone by node id (call after a successful revival so
 * it doesn't linger in the "Recently cleaned" drawer).
 */
export async function consumeTombstoneById(nodeId: string): Promise<void> {
  const all = await readAll();
  const filtered = all.filter((t) => t.nodeId !== nodeId);
  if (filtered.length !== all.length) {
    await writeAll(filtered);
  }
}

/** Drawer API: list all live tombstones, newest first. */
export async function listTombstones(): Promise<CleanupTombstone[]> {
  const now = Date.now();
  const fresh = dropExpired(await readAll(), now);
  // Evict if any expired.
  const all = await readAll();
  if (fresh.length !== all.length) await writeAll(fresh);
  return [...fresh].sort((a, b) => b.removedAt - a.removedAt);
}

/** Drawer action: clear all tombstones. */
export async function clearAllTombstones(): Promise<void> {
  await writeAll([]);
}

/** Drawer action: drop one tombstone explicitly. */
export async function clearTombstone(nodeId: string): Promise<void> {
  await consumeTombstoneById(nodeId);
}
