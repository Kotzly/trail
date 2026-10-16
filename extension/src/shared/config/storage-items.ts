/**
 * Central storage item definitions — single source of truth for all
 * persisted keys used by the extension.
 *
 * Every service imports items from here instead of declaring its own
 * key constants. The `storage.defineItem()` API gives us typed
 * `.getValue()` / `.setValue()` / `.watch()` per item.
 */

import { storage } from "wxt/utils/storage";
import type { NavigationTreeJSON, TreeMeta, TreeIndexEntry } from "../types/tree.js";
import type { Settings } from "../types/settings.js";
import type { PersistedFlagState } from "../types/flags.js";
import type { LayoutPositionsCacheEntry } from "@background/services/layout-cache-signature.js";
import type { ConflictPickState } from "../types/tree-diff.js";

// ── Tree ────────────────────────────────────────────────────────────

export const activeTreeItem = storage.defineItem<NavigationTreeJSON | null>("local:trail_tree", {
  fallback: null,
});

export const activeTreeMetaItem = storage.defineItem<TreeMeta | null>("local:trail_tree_meta", {
  fallback: null,
});

// Legacy key name kept to avoid a storage migration. The "archives"
// suffix is historical; the list holds every tree except the active one.
export const treeIndexItem = storage.defineItem<TreeIndexEntry[]>("local:trail_tree_archives", {
  fallback: [],
});

export const treeSavedAtItem = storage.defineItem<number | null>("local:trail_tree_saved_at", {
  fallback: null,
});

// ── Per-tree blobs (dynamic keys) ────────────────────────────────────

/** Build a prefixed key for a per-tree compressed tree blob. */
export function treeBlobKey(treeId: string): `local:trail_ar_${string}` {
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

// ── Onboarding ──────────────────────────────────────────────────────

export const hasSeenOnboardingItem = storage.defineItem<boolean>(
  "local:trail_has_seen_onboarding",
  { fallback: false },
);

export type OnboardingPersona = "research" | "article" | "learning" | "tabs";

export type OnboardingPhase = "wizard" | "done";

export type OnboardingState = {
  seenWelcome: boolean;
  completedAt: number | null;
  /** Legacy step counter from the original linear wizard. Preserved so
   * users who saw the old wizard don't retrigger the new one. */
  step: number;
  /** Onboarding phase. `null` before first run; `"wizard"` while the
   * modal is open; `"done"` after the user finishes or skips. There
   * is no resume / postpone state — skip is terminal. */
  phase?: OnboardingPhase | null;
  /** 0-indexed position inside screens 1-5 of the modal wizard. */
  wizardStep?: number;
  /** User's self-identified pain. Drives the solution-screen copy. */
  persona?: OnboardingPersona | null;
  startedAt?: number | null;
};

/**
 * Canonical initial shape for onboarding state. Used as the storage
 * `fallback` AND as the reset target for "Replay onboarding" in
 * Settings → About so those two stay in lock-step when the type
 * grows.
 */
export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  seenWelcome: false,
  completedAt: null,
  step: 0,
  phase: null,
  wizardStep: 0,
  persona: null,
  startedAt: null,
};

export const onboardingStateItem = storage.defineItem<OnboardingState>("local:trail_onboarding", {
  fallback: INITIAL_ONBOARDING_STATE,
});

/**
 * Set by the SW's onInstalled handler when an existing install is
 * upgraded into the 1.1 line from any earlier release. The sidepanel
 * reads this on mount and shows a one-time "what's new" dialog, then
 * clears it. Null at all other times (fresh installs, patch bumps
 * within the 1.1.x series).
 */
export const pendingWelcomeBackVersionItem = storage.defineItem<string | null>(
  "local:trail_pending_welcome_back",
  { fallback: null },
);

// ── Auth / Device / Sync ────────────────────────────────────────────

export type AuthProvider = "email" | "google" | "github" | "other";

export type AuthIdentity = {
  userId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  provider: AuthProvider;
};

export const authIdentityItem = storage.defineItem<AuthIdentity | null>(
  "local:trail_auth_identity",
  { fallback: null },
);

/**
 * The most recently signed-in user id on this browser. Survives signOut
 * (unlike `authIdentityItem` and `provisionedUsersItem`) so the next
 * sign-in can detect "different account" and wipe stale per-user local
 * state — local trees, syncStateItem, pendingSyncOpsItem, deviceId, etc.
 * Without this, a new user inherits the previous user's tree blobs and
 * the upsert path immediately hits Postgres RLS:
 *   "new row violates row-level security policy (USING expression)"
 * because the trail row already exists in Supabase under the previous
 * `user_id` and the UPDATE branch of `INSERT ... ON CONFLICT DO UPDATE`
 * fails the `user_id = auth.uid()` USING check.
 */
export const lastSignedInUserIdItem = storage.defineItem<string | null>(
  "local:trail_last_signed_in_user",
  { fallback: null },
);

export const deviceIdItem = storage.defineItem<string | null>("local:trail_device_id", {
  fallback: null,
});

/**
 * Per-user provisioning cache. After the first successful
 * `provisionSignedInUser` call, the userId is recorded here so subsequent
 * surface mounts (settings, sidepanel, login) skip the redundant
 * `users` upsert + `sync_public_user_from_auth` RPC + `devices` upsert
 * round-trips. Device `last_seen_at` is refreshed on a throttle instead.
 *
 * Cleared on sign-out so a re-sign-in re-runs full provisioning.
 */
export type UserProvisionMeta = {
  /** Unix-ms when ensurePublicUser+device first ran for this user. */
  provisionedAt: number;
  /** Unix-ms of the most recent device upsert. */
  deviceLastSeenAt: number;
};

export const provisionedUsersItem = storage.defineItem<Record<string, UserProvisionMeta>>(
  "local:trail_provisioned_users",
  { fallback: {} },
);

export type SyncStateMeta = {
  /** Server-side updated_at ISO of the local tree's last successful push. */
  lastSyncedAt: string | null;
  /** Server-side updated_at we observed on last pull; used to detect drift. */
  lastRemoteUpdatedAt: string | null;
  /** Local mutation counter at last push; bumped on every mutation. */
  lastPushedLocalVersion: number;
};

export const syncStateItem = storage.defineItem<Record<string, SyncStateMeta>>(
  "local:trail_sync_state",
  { fallback: {} },
);

export type PendingSyncOp =
  | { kind: "push_tree"; treeId: string; queuedAt: number }
  | { kind: "delete_tree"; treeId: string; queuedAt: number };

export const pendingSyncOpsItem = storage.defineItem<PendingSyncOp[]>(
  "local:trail_pending_sync_ops",
  { fallback: [] },
);

// ── Telemetry ───────────────────────────────────────────────────────

export type TelemetryConsent = {
  errors: boolean; // Sentry error reporting (defaults off in this fork)
  analytics: boolean; // PostHog product analytics (defaults off in this fork)
  decidedAt: number | null; // timestamp user explicitly set consent
};

export const telemetryConsentItem = storage.defineItem<TelemetryConsent>(
  "local:trail_telemetry_consent",
  { fallback: { errors: false, analytics: false, decidedAt: null } },
);

export const telemetryAnonIdItem = storage.defineItem<string | null>(
  "local:trail_telemetry_anon_id",
  { fallback: null },
);

// ── Conflict picks (session-scoped) ──────────────────────────────────
//
// User's per-node cherry-picks for the sync-conflict dialog. Keyed by
// treeId and invalidated when `serverUpdatedAt` changes (hydration-time
// check). Session storage so picks survive sidepanel unmount/remount
// within a browser session but don't persist across restart — the
// conflict banner re-fires on next pull if still outstanding.

export const conflictPicksItem = storage.defineItem<Record<string, ConflictPickState>>(
  "session:trail_conflict_picks",
  { fallback: {} },
);

export const layoutPositionsCacheItem = storage.defineItem<
  Record<string, LayoutPositionsCacheEntry>
>("session:trail_layout_positions", { fallback: {} });

// ── Pending share-link import (session-scoped) ──────────────────────
//
// Set when a marketing page sends `site/import-shared-trail`. The
// background handler stores the share code here and opens the sidepanel,
// where `ShareImportPrompt` reads it and asks the user to confirm the
// import — we never import a shared trail without an explicit in-extension
// confirmation. Cleared on confirm/dismiss AND on the per-user wipe so
// account switches don't carry the previous viewer's pending import into
// a different account (premortem #5).

export type PendingShareImport = {
  /** Share code received from the bridge. */
  code: string;
  /** Unix-ms when the bridge call was received; used for staleness checks. */
  queuedAt: number;
  /** Optional display hints from the share page so the prompt can name the
   * trail before the import runs. Cosmetic only — the import is keyed on
   * `code` server-side. */
  label?: string;
  nodeCount?: number;
};

export const pendingShareImportItem = storage.defineItem<PendingShareImport | null>(
  "session:trail_pending_share_import",
  { fallback: null },
);

// ── Auto-cleanup tombstones ─────────────────────────────────────────
//
// When a node is silently pruned by the glance cleanup layer, a
// tombstone is recorded so the node can be revived if the user
// returns to its URL within TOMBSTONE_TTL_MS (72h). Transparent to
// the user — revival happens on the next nav to the same URL.
//
// Eviction: on every tombstone write, entries older than TTL are
// dropped.

export type CleanupReason = "glance";

export type CleanupTombstone = {
  /** Matches a pruned node id before it was removed. Post-revival this
   * id is reused when recreating the node. */
  nodeId: string;
  /** Original URL + metadata of the pruned node. */
  url: string;
  title: string;
  favicon: string | null;
  /** The parent id the node used to live under. If missing at revival
   * time (parent also deleted), revive as root child of current tree. */
  parentId: string | null;
  /** Unix-ms of removal. Drives 72h TTL. */
  removedAt: number;
  /** Why it was removed — surfaces as a pill in the drawer. */
  reason: CleanupReason;
};

export const cleanupTombstonesItem = storage.defineItem<CleanupTombstone[]>(
  "local:trail_cleanup_tombstones",
  { fallback: [] },
);

/**
 * Local "I just deleted this" tombstones for trees, indexed by treeId.
 * Bridges the window between local DELETE_TREE and server-side
 * `deleted_at = now()` so a periodic pull arriving mid-flight cannot
 * re-stub the tree from a server row that hasn't been soft-deleted yet.
 *
 * 24h TTL — long enough to cover offline-then-online + clock skew, much
 * shorter than the 30-day server retention. Cleared on successful
 * server ack (sync-engine `doDelete` sets `deleted_at` then unsets the
 * tombstone) or by `cancelPendingDelete` (Undo path).
 */
export type LocalDeleteTombstone = {
  /** Unix ms when the local delete was issued. */
  deletedAt: number;
};

export const LOCAL_DELETE_TOMBSTONE_TTL_MS = 24 * 60 * 60 * 1000;

export const localDeleteTombstonesItem = storage.defineItem<Record<string, LocalDeleteTombstone>>(
  "local:trail_local_delete_tombstones",
  { fallback: {} },
);

// ── Storage scope registry ──────────────────────────────────────────
//
// Single source of truth for "which storage items must be wiped when the
// signed-in user changes on this browser." The auth wipe path iterates
// this registry and calls `.setValue(<reset>)` on each, so adding a new
// user-scoped key requires only adding its `defineItem` here — there is
// no separate hand-maintained allow-list to forget.
//
// Scopes:
//   - "user":   tied to a single auth.uid(). Wiped on user switch AND
//               sign-out is allowed to leave them (account-switch wipe
//               is the authoritative point). Survives same-user sign-in.
//   - "device": tied to this physical browser install. Survives user
//               switches. Includes onboarding, settings, telemetry,
//               flags state.
//   - "global": app-level config (e.g. flag definitions).
//   - "auth-meta": carries the wipe trigger itself (lastSignedInUserIdItem)
//               or auth bookkeeping not bound to a specific user
//               (provisionedUsersItem). MUST NOT be wiped on user switch
//               or `runUserChangeWipeIfNeeded` becomes its own footgun.
//
// `treeStorage.clearAllTrees()` handles dynamic per-tree blob keys and
// is NOT registered here — keep it as an explicit call in the wipe
// alongside this iteration.

/** A persisted item that may be wiped on user switch. */
export type UserScopedStorageItem = {
  /** Human label used in wipe error logging. */
  label: string;
  /** Reset the item to its empty / safe-default value. */
  reset: () => Promise<void>;
};

export const USER_SCOPED_STORAGE_ITEMS: readonly UserScopedStorageItem[] = [
  { label: "syncState", reset: () => syncStateItem.setValue({}) },
  { label: "pendingSyncOps", reset: () => pendingSyncOpsItem.setValue([]) },
  { label: "localDeleteTombstones", reset: () => localDeleteTombstonesItem.setValue({}) },
  { label: "cleanupTombstones", reset: () => cleanupTombstonesItem.setValue([]) },
  { label: "openTabs", reset: () => openTabsItem.setValue({}) },
  { label: "undoHistory", reset: () => undoHistoryItem.setValue(null) },
  { label: "conflictPicks", reset: () => conflictPicksItem.setValue({}) },
  { label: "layoutPositions", reset: () => layoutPositionsCacheItem.setValue({}) },
  // Drop any pending share-import code queued under the previous viewer —
  // three-actor cross-tenant trap from premortem #5 + lesson 2026-04-27
  // on account-switch wipe completeness.
  { label: "pendingShareImport", reset: () => pendingShareImportItem.setValue(null) },
  // Rotate the device id so `ensureDeviceRegistered` inserts a fresh
  // `devices` row instead of upserting on top of the previous user's row
  // (which silently fails RLS USING and leaves an orphan).
  { label: "deviceId", reset: () => deviceIdItem.setValue(null) },
] as const;
