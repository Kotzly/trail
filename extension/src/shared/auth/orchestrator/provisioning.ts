/**
 * First-time-user provisioning + device registration.
 *
 * Public-table rows (public.users, public.devices) that every subsequent
 * `trails` / `account_settings` write depends on via FK. Throttled per
 * device so we don't spam the backend on every surface mount.
 */

import { getSupabaseClient } from "@shared/lib/supabase.js";
import { provisionedUsersItem, type AuthIdentity } from "@shared/config/storage-items.js";
import { captureError } from "@shared/lib/observability.js";
import { ensureDeviceId } from "./session.js";
import { runUserChangeWipeIfNeeded } from "./wipe.js";

/**
 * How often `devices.last_seen_at` is refreshed once the user has been
 * provisioned. Prevents every surface mount (settings open, sidepanel
 * remount, token refresh) from upserting the row.
 */
const DEVICE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

function detectOs(ua: string): string | null {
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  return null;
}

/**
 * Create the `public.users` row for a freshly authenticated user.
 * Migration 005 dropped the auth.users → public.users sync trigger,
 * so every client that bypasses the Next.js auth callback (i.e. the
 * extension, which calls Supabase Auth directly for Google OAuth,
 * email+password, and OTP) has to provision its own row. Without it,
 * every `trails` / `devices` / `account_settings` insert fails
 * `trails_user_id_fkey` because `trails.user_id` → `users(id)`.
 *
 * `ignoreDuplicates: true` keeps the call idempotent and avoids
 * tripping migration 007's column-UPDATE grants (UPDATE is restricted
 * to a safe allow-list; INSERT has no such restriction beyond the RLS
 * "insert_own" check of `id = auth.uid()`). After insert we call the
 * `sync_public_user_from_auth` RPC so `email_verified` reflects
 * `auth.users.email_confirmed_at` instead of the optimistic `true` we
 * write on the insert path.
 */
async function ensurePublicUser(identity: AuthIdentity): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const now = new Date().toISOString();
    const { error: upsertError } = await supabase.from("users").upsert(
      {
        id: identity.userId,
        email: identity.email ?? "",
        name: identity.displayName ?? identity.email ?? identity.userId,
        image: identity.avatarUrl,
        image_url: identity.avatarUrl,
        created_at: now,
        updated_at: now,
        auth_session_version: 1,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (upsertError) throw upsertError;
    // Best-effort reconcile `email_verified` with `auth.users`. Safe
    // to ignore failures — a stale `email_verified=true` on a row we
    // just inserted is the same value the RPC would write for a
    // confirmed user, and the server side runs this on every session
    // establish anyway.
    const { error: rpcError } = await supabase.rpc("sync_public_user_from_auth", {
      p_user_id: identity.userId,
    });
    if (rpcError) captureError(rpcError, { kind: "auth_sync_public_user" });
  } catch (err) {
    captureError(err, { kind: "auth_ensure_public_user" });
  }
}

/**
 * Upsert the current device into `public.devices`. Required before any
 * `trails` write because `trails.device_id` has a FK to `devices.id`.
 * Idempotent — safe to call on every signed-in transition.
 */
async function ensureDeviceRegistered(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const deviceId = await ensureDeviceId();
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const chromeVersion = ua.match(/Chrome\/(\S+)/)?.[1] ?? null;
    const manifestVersion =
      typeof chrome !== "undefined" && chrome.runtime?.getManifest
        ? chrome.runtime.getManifest().version
        : null;
    const { error } = await supabase.from("devices").upsert(
      {
        id: deviceId,
        user_id: userId,
        os: detectOs(ua),
        locale: typeof navigator !== "undefined" ? navigator.language : null,
        timezone:
          typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null,
        browser_name: "Chrome",
        browser_version: chromeVersion,
        extension_version: manifestVersion,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) throw error;
  } catch (err) {
    captureError(err, { kind: "auth_device_register" });
  }
}

/**
 * Provision everything a signed-in identity needs server-side before
 * the extension tries to write trails. Order matters: `devices` and
 * every other public table have a FK to `public.users(id)`, so the
 * user row has to exist first.
 *
 * Throttled via `provisionedUsersItem`: once a user has been seen on
 * this device, the `users` upsert and `sync_public_user_from_auth` RPC
 * are skipped on subsequent `initAuth()` runs. The `devices` upsert is
 * refreshed on a daily cadence so `last_seen_at` stays roughly fresh
 * without spamming the backend on every surface mount.
 */
export async function provisionSignedInUser(identity: AuthIdentity): Promise<void> {
  // Account-switch wipe runs first so the sync engine never observes
  // the previous user's local trees under the new `auth.uid()`, which
  // would fail the trails RLS USING check on every upsert.
  await runUserChangeWipeIfNeeded(identity);

  const cache = await provisionedUsersItem.getValue();
  const entry = cache[identity.userId];
  const now = Date.now();

  if (entry) {
    if (now - entry.deviceLastSeenAt < DEVICE_REFRESH_INTERVAL_MS) return;
    await ensureDeviceRegistered(identity.userId);
    cache[identity.userId] = { ...entry, deviceLastSeenAt: now };
    await provisionedUsersItem.setValue(cache);
    return;
  }

  await ensurePublicUser(identity);
  await ensureDeviceRegistered(identity.userId);
  cache[identity.userId] = { provisionedAt: now, deviceLastSeenAt: now };
  await provisionedUsersItem.setValue(cache);
}
