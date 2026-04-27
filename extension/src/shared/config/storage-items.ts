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
import type { BackendConfigOverride } from "./backend.js";
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

// ── Backend config ──────────────────────────────────────────────────

export const backendConfigItem = storage.defineItem<BackendConfigOverride | null>(
  "local:trail_backend_config",
  { fallback: null },
);

// ── Onboarding ──────────────────────────────────────────────────────

export const hasSeenOnboardingItem = storage.defineItem<boolean>(
  "local:trail_has_seen_onboarding",
  { fallback: false },
);

export type OnboardingPersona = "research" | "article" | "learning" | "tabs";

export type OnboardingPhase = "wizard" | "tour" | "tourDismissed" | "celebration" | "cta" | "done";

export type OnboardingSoftCtaKey = "signin" | "pin";

export type OnboardingState = {
  seenWelcome: boolean;
  completedAt: number | null;
  /** Legacy step counter from the original linear wizard. Preserved so
   * users who saw the old wizard don't retrigger the new one. */
  step: number;
  /** v2 onboarding phase. `null` before first run; `"done"` after full
   * completion (success or skip). Intermediate values gate resume UI. */
  phase?: OnboardingPhase | null;
  /** 0-indexed position inside screens 1-5 of the modal wizard. */
  wizardStep?: number;
  /** 0-indexed position inside the in-sidepanel tour micro-steps. */
  tourStep?: number;
  /** User's self-identified pain. Drives screen-4 solution copy and
   * screen-8 CTA tagline. */
  persona?: OnboardingPersona | null;
  /** Tree created specifically for the tour so we can delete it on
   * completion without touching the user's real data. */
  tourTreeId?: string | null;
  /** Captured at tour step 1 (clickResult) — the id of the FIRST
   * result child under Google. Needed by step 4
   * (returnToAbandoned), which asks the user to click this specific
   * node. Persisted so a sidepanel close mid-tour doesn't lose the
   * anchor and leave the user with an un-matchable predicate. */
  tourFirstResultChildId?: string | null;
  /** Captured at tour step 3 (branch) — the Google node id at the
   * moment branching was detected. Same rationale as above. */
  tourBranchParentId?: string | null;
  /** Tree id that was active BEFORE we created the tour tree. On
   * tour disposal we switch back to this tree, because the
   * background refuses to delete the active tree. Null for
   * fresh-install users with no pre-existing tree. */
  priorActiveTreeId?: string | null;
  startedAt?: number | null;
  /** Per-surface dismiss flags for the post-onboarding hint strip.
   * Only explicit user-× writes `true`; `undefined`/missing = show.
   * Auto-hide on auth signed-in is predicate-level (no write), so
   * the strip returns on sign-out. */
  softCtaDismissed?: { signin?: boolean; pin?: boolean };
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
  tourStep: 0,
  persona: null,
  tourTreeId: null,
  tourFirstResultChildId: null,
  tourBranchParentId: null,
  priorActiveTreeId: null,
  startedAt: null,
};

export const onboardingStateItem = storage.defineItem<OnboardingState>("local:trail_onboarding", {
  fallback: INITIAL_ONBOARDING_STATE,
});

// ── Auth / Device / Sync ────────────────────────────────────────────

export type AuthProvider = "email" | "google" | "other";

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
  errors: boolean; // Sentry error reporting (defaults on)
  analytics: boolean; // PostHog product analytics (defaults on)
  decidedAt: number | null; // timestamp user explicitly set consent
};

export const telemetryConsentItem = storage.defineItem<TelemetryConsent>(
  "local:trail_telemetry_consent",
  { fallback: { errors: true, analytics: true, decidedAt: null } },
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
