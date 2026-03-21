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
import type { TagDefinition } from "../types/tags.js";
import type { AccountSnapshot } from "../types/account.js";
import type { BackendConfigOverride } from "./backend.js";
import type { SpotlightUsageStats } from "@features/spotlight/model/usage-stats.js";
import type { EditorModeState } from "../rpc/contracts.js";

// ── Auth ────────────────────────────────────────────────────────────

/** Shared auth session shape, previously duplicated across 5 files. */
export type StoredAuthSession = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
};

export const authSessionItem = storage.defineItem<StoredAuthSession | null>(
  "local:trail_auth_session",
  { fallback: null },
);

export const oauthDeviceIdItem = storage.defineItem<string | null>("local:trail_oauth_device_id", {
  fallback: null,
});

/** Backwards-compat re-export (raw key without area prefix). */
export const AUTH_STORAGE_KEY = "trail_auth_session" as const;

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

// ── Sync ────────────────────────────────────────────────────────────

export type SyncState = {
  serverSyncAt: string | null;
  dirtyIds: string[];
  pendingDeletes: string[];
};

export const syncStateItem = storage.defineItem<SyncState | null>("local:trail_v3_sync", {
  fallback: null,
});

export const syncDeviceIdItem = storage.defineItem<string | null>("local:trail_sync_device_id", {
  fallback: null,
});

export const migrationDoneItem = storage.defineItem<boolean>("local:trail_v3_migration_done", {
  fallback: false,
});

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

// ── Tags (sync area) ───────────────────────────────────────────────

export const tagDefsItem = storage.defineItem<TagDefinition[] | null>("sync:trail_tag_defs", {
  fallback: null,
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

// ── Account ─────────────────────────────────────────────────────────

export type CachedSnapshotEnvelope = {
  snapshot: AccountSnapshot;
  fetchedAt: number;
};

export const accountSnapshotItem = storage.defineItem<CachedSnapshotEnvelope | null>(
  "local:trail_account_snapshot",
  { fallback: null },
);

// ── Backend config ──────────────────────────────────────────────────

export const backendConfigItem = storage.defineItem<BackendConfigOverride | null>(
  "local:trail_backend_config",
  { fallback: null },
);

// ── Spotlight ───────────────────────────────────────────────────────

export const spotlightUsageStatsItem = storage.defineItem<SpotlightUsageStats | null>(
  "local:trail_spotlight_usage_stats",
  { fallback: null },
);

// ── Auth Policy ────────────────────────────────────────────────────

export type CachedAuthPolicy = {
  authRequired: boolean;
  fetchedAt: number;
};

export const authPolicyItem = storage.defineItem<CachedAuthPolicy | null>(
  "local:trail_auth_policy",
  { fallback: null },
);

// ── Guest Welcome ──────────────────────────────────────────────────

export const guestWelcomeDismissedItem = storage.defineItem<boolean>(
  "local:trail_guest_welcome_dismissed",
  { fallback: false },
);

// ── UI State ───────────────────────────────────────────────────────

export const spotlightSplitRatioItem = storage.defineItem<number>(
  "local:trail_spotlight_split_ratio",
  { fallback: 0.38 },
);

export const themeCacheItem = storage.defineItem<string | null>("session:trail_theme_cache", {
  fallback: null,
});

// ── Editor State (session-scoped) ────────────────────────────────────

export const editorStateItem = storage.defineItem<EditorModeState>(
  "session:trail_editor_state",
  { fallback: { active: false, treeId: null } },
);
