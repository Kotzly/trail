/**
 * Per-user / sign-out wipe.
 *
 * `runUserChangeWipeIfNeeded` is the only line of defence against
 * cross-account data leakage on a shared browser: when the signed-in
 * userId changes, every per-user storage bucket must be cleared before
 * the new identity broadcasts `signed-in`. A regression that drops one
 * of these clears means the next user inherits the previous user's
 * trees, sync metadata, queued cloud ops, or — worst — their device id
 * (which silently fails the `devices` RLS USING check and leaves an
 * orphan).
 *
 * The list of items to wipe lives in `storage-items.ts` as the
 * `USER_SCOPED_STORAGE_ITEMS` registry. To add a new user-scoped key,
 * declare it in `storage-items.ts` and add it to that registry — this
 * file does not need to change.
 */

import { getSupabaseClient } from "@shared/lib/supabase.js";
import {
  USER_SCOPED_STORAGE_ITEMS,
  lastSignedInUserIdItem,
  provisionedUsersItem,
  syncStateItem,
  type AuthIdentity,
} from "@shared/config/storage-items.js";
import { treeStorage } from "@background/services/tree-storage.js";
import { captureError, captureEvent, resetTelemetryIdentity } from "@shared/lib/observability.js";
import { fireAuthTransition, log, notify, persistIdentity } from "./session.js";

/**
 * Wipe every per-user persisted bucket on this browser. Called when the
 * sign-in identity differs from the last one we saw — at that point the
 * old user's trees, sync metadata, queued cloud ops, and device row no
 * longer belong to the active session, and pushing them under the new
 * `auth.uid()` fails the trails/devices RLS USING check.
 *
 * Settings/onboarding/telemetry/flag state is intentionally left alone —
 * it's either device-scoped or hydrates from the server on demand.
 *
 * Each bucket reset is wrapped in `safeRun` so a single failing item
 * cannot abort the rest of the wipe — partial completion is strictly
 * better than refusing to broadcast `signed-in` at all.
 */
export async function wipeUserScopedLocalState(): Promise<void> {
  const safeRun = async (label: string, fn: () => Promise<void>): Promise<void> => {
    try {
      await fn();
    } catch (err) {
      log.warn(`wipeUserScopedLocalState: ${label} failed`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };
  // Per-tree blobs use dynamic keys, so they can't sit in the registry —
  // keep the explicit call here.
  await safeRun("trees", () => treeStorage.clearAllTrees());
  for (const item of USER_SCOPED_STORAGE_ITEMS) {
    await safeRun(item.label, () => item.reset());
  }
}

/**
 * If the previously-seen signed-in user on this browser differs from
 * the one currently signing in, scrub every per-user storage bucket
 * before broadcasting `signed-in`. Idempotent — once
 * `lastSignedInUserIdItem` matches, subsequent calls are no-ops.
 *
 * Pure chrome.storage I/O. No Supabase calls — safe to await inside
 * `onAuthStateChange` (unlike `provisionSignedInUser`, which talks to
 * Supabase and must stay fire-and-forget there to avoid the
 * navigator.locks deadlock).
 */
export async function runUserChangeWipeIfNeeded(identity: AuthIdentity): Promise<void> {
  const previousUserId = await lastSignedInUserIdItem.getValue();
  if (previousUserId === identity.userId) return;
  if (previousUserId) {
    log.info("auth: account switch detected, wiping per-user local state", {
      from: previousUserId,
      to: identity.userId,
    });
    await wipeUserScopedLocalState();
    fireAuthTransition("account-switched");
    captureEvent("auth_user_changed_wipe");
  }
  // Always advance the discriminator — first sign-in on a fresh
  // install hits this path with `previousUserId === null` and we want
  // future sign-ins as a different user to wipe.
  await lastSignedInUserIdItem.setValue(identity.userId);
}

/**
 * Sign out the current user. Tears down the server session, drops the
 * provisioning cache + server-only local state (tree stubs, sync state),
 * fires the transition for subscribers, and broadcasts `signed-out`.
 *
 * Local trees with full payload remain intact and accessible offline —
 * `runUserChangeWipeIfNeeded` is still the authoritative point at which
 * the previous user's local data is invalidated (next sign-in path).
 */
export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch (error) {
    captureError(error, { kind: "auth_signout" });
  }
  await persistIdentity(null);
  // Drop the provisioning cache so a re-sign-in (possibly as a different
  // user, possibly after a server-side account deletion) re-runs the full
  // ensurePublicUser path.
  await provisionedUsersItem.setValue({});
  // Drop server-only data: stub entries in the tree index (pointers to
  // trees we never downloaded; useless when signed out) and the per-tree
  // sync state map (lastSyncedAt / lastRemoteUpdatedAt are all
  // server-relative; resync from scratch on next sign-in).
  await treeStorage.dropRemoteStubs();
  await syncStateItem.setValue({});
  // Notify subscribers (sync engine resets module state, sidepanel
  // refreshes the now-stub-free tree list) without touching disk.
  fireAuthTransition("signed-out");
  captureEvent("auth_signout");
  await resetTelemetryIdentity();
  notify({ status: "signed-out" });
}
