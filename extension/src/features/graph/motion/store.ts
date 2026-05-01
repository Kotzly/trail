/**
 * External store for motion flags, read by `useMotionFlag` via
 * `useSyncExternalStore`.
 *
 * We keep this outside the main zustand store because:
 *  - it is ephemeral (not persisted, not synced);
 *  - it is rarely updated (at most once per refresh window);
 *  - selector subscription is critical — one flag change must not
 *    re-render every consumer, just the ones reading the changed key.
 *
 * The store is a plain module singleton. `MotionFlagsProvider` drives
 * its lifecycle (initial fetch + refresh interval); consumers read via
 * the hook and never write directly.
 */

import { useSyncExternalStore } from "react";
import {
  DEFAULT_MOTION_CONFIG,
  motionConfigEqual,
  type MotionConfig,
  type MotionFlagKey,
} from "./flags.js";

let snapshot: MotionConfig = DEFAULT_MOTION_CONFIG;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Replace the snapshot. No-op if the incoming config is equal to the current one. */
export function setMotionSnapshot(next: MotionConfig): void {
  if (motionConfigEqual(snapshot, next)) return;
  snapshot = next;
  for (const l of listeners) l();
}

/** Imperative read — avoid in render; use `useMotionFlag` instead. */
export function getMotionSnapshot(): MotionConfig {
  return snapshot;
}

/**
 * Read a single motion flag. Subscribes to changes for *this key only*;
 * components only re-render when their specific flag flips.
 */
export function useMotionFlag<K extends MotionFlagKey>(key: K): boolean {
  return useSyncExternalStore(
    subscribe,
    () => snapshot[key],
    () => DEFAULT_MOTION_CONFIG[key],
  );
}
