/**
 * Central storage item definitions — single source of truth for all
 * persisted keys used by the extension.
 *
 * Every service imports items from here instead of declaring its own
 * key constants. The `storage.defineItem()` API gives us typed
 * `.getValue()` / `.setValue()` / `.watch()` per item.
 */

import { storage } from "wxt/utils/storage";
import type { NavigationTreeJSON, TreeMeta, ArchiveIndexEntry } from "../types/tree.js";
import type { Settings } from "../types/settings.js";
import type { PersistedFlagState } from "../types/flags.js";
import type { BackendConfigOverride } from "./backend.js";
import type { EditorModeState } from "../rpc/contracts.js";

// ── Tree ────────────────────────────────────────────────────────────

export const activeTreeItem = storage.defineItem<NavigationTreeJSON | null>("local:trail_tree", {
  fallback: null,
});

export const activeTreeMetaItem = storage.defineItem<TreeMeta | null>("local:trail_tree_meta", {
  fallback: null,
});

export const archiveIndexItem = storage.defineItem<ArchiveIndexEntry[]>(
  "local:trail_tree_archives",
  { fallback: [] },
);

export const treeSavedAtItem = storage.defineItem<number | null>("local:trail_tree_saved_at", {
  fallback: null,
});

// ── Archive blobs (dynamic keys) ────────────────────────────────────

/** Build a prefixed key for a per-tree compressed archive blob. */
export function archiveBlobKey(treeId: string): `local:trail_ar_${string}` {
  return `local:trail_ar_${treeId}`;
}

// ── Settings ────────────────────────────────────────────────────────

export const settingsItem = storage.defineItem<Settings | null>("local:trail_settings", {
  fallback: null,
});

// ── Flags ───────────────────────────────────────────────────────────

export const flagsItem = storage.defineItem<PersistedFlagState | null>("local:trail_flags", {
  fallback: null,
});

export const experimentsUnlockedItem = storage.defineItem<boolean>("local:trail_flags_unlocked", {
  fallback: false,
});

// ── Undo / Redo ─────────────────────────────────────────────────────

export type CommandHistory = {
  undoStack: unknown[];
  redoStack: unknown[];
  updatedAt: number;
};

export const undoHistoryItem = storage.defineItem<CommandHistory | null>(
  "local:trail_undo_history",
  { fallback: null },
);

// ── Tab restoration ─────────────────────────────────────────────────

export const openTabsItem = storage.defineItem<Record<string, string[]>>(
  "local:trail_tree_open_tabs",
  { fallback: {} },
);

// ── Backend config ──────────────────────────────────────────────────

export const backendConfigItem = storage.defineItem<BackendConfigOverride | null>(
  "local:trail_backend_config",
  { fallback: null },
);

// ── UI State ───────────────────────────────────────────────────────

export const themeCacheItem = storage.defineItem<string | null>("session:trail_theme_cache", {
  fallback: null,
});

// ── Onboarding ──────────────────────────────────────────────────────

export const hasSeenOnboardingItem = storage.defineItem<boolean>(
  "local:trail_has_seen_onboarding",
  { fallback: false },
);

// ── Editor State (session-scoped) ────────────────────────────────────

export const editorStateItem = storage.defineItem<EditorModeState>(
  "session:trail_editor_state",
  { fallback: { active: false, treeId: null } },
);
