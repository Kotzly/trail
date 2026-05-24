import { getSupabaseClient } from "@shared/lib/supabase.js";
import { captureError } from "@shared/lib/observability.js";
import { MARKETING_ORIGIN } from "@shared/config/marketing-urls.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import { sanitizeTreeForShare } from "./sanitize.js";

export type ShareVisibility = "public" | "restricted";

export type ShareLinkRow = {
  code: string;
  trail_id: string;
  label: string;
  root_url: string | null;
  root_title: string | null;
  node_count: number;
  created_at: string;
  revoked_at: string | null;
  view_count: number;
  visibility: ShareVisibility;
  acl_count: number;
};

export type ShareAclEntry = {
  email: string;
  created_at: string;
};

export type CreateShareResult = {
  code: string;
  url: string;
  label: string;
  createdAt: string;
};

export type ImportShareSuccess = {
  ok: true;
  trailId: string;
  label: string;
  nodeCount: number;
};

export type ImportShareErrorCode =
  | "needs-signin"
  | "share-unavailable"
  | "share-self-import"
  | "share-no-device"
  | "unknown";

export type ImportShareError = {
  ok: false;
  error: ImportShareErrorCode;
  message?: string;
};

export type ImportShareResult = ImportShareSuccess | ImportShareError;

/**
 * Build the public share URL the user copies. The host comes from
 * `MARKETING_ORIGIN` so any environment switch (e.g. staging) lives in
 * one place — see `extension/src/shared/config/marketing-urls.ts`.
 */
export function buildShareUrl(code: string): string {
  return `${MARKETING_ORIGIN}/s/${code}`;
}

/**
 * Mint a new share link for one of the caller's trails. Sanitizes the
 * tree snapshot client-side before sending; server enforces
 * structural caps (2 MB / 10k nodes) as a defensive layer.
 */
export async function createShareLink(
  trailId: string,
  tree: NavigationTreeJSON,
): Promise<CreateShareResult> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase client not available");
  const sanitized = sanitizeTreeForShare(tree);
  const { data, error } = await supabase.rpc("create_share_link", {
    p_trail_id: trailId,
    p_snapshot: sanitized,
  });
  if (error) {
    captureError(error, { kind: "share_create" });
    throw new Error(error.message);
  }
  const payload = data as { code: string; created_at: string; label: string } | null;
  if (!payload?.code) {
    throw new Error("share_create_unexpected_response");
  }
  return {
    code: payload.code,
    url: buildShareUrl(payload.code),
    label: payload.label,
    createdAt: payload.created_at,
  };
}

/**
 * Enumerate the caller's share links. RLS-filtered server-side via
 * SECURITY INVOKER on the RPC; no filtering needed here.
 */
export async function listMyShareLinks(): Promise<ShareLinkRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase client not available");
  const { data, error } = await supabase.rpc("list_my_share_links");
  if (error) {
    captureError(error, { kind: "share_list" });
    throw new Error(error.message);
  }
  return (data ?? []) as ShareLinkRow[];
}

/**
 * Flip a share between `public` and `restricted`. Owner-only —
 * `share_not_owner` errors map to a thrown Error here so callers can
 * toast it.
 */
export async function setShareVisibility(
  code: string,
  visibility: ShareVisibility,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase client not available");
  const { data, error } = await supabase.rpc("set_share_visibility", {
    p_code: code,
    p_visibility: visibility,
  });
  if (error) {
    captureError(error, { kind: "share_set_visibility" });
    throw new Error(error.message);
  }
  return data === true;
}

/**
 * Replace the email allowlist for a share. The RPC normalizes
 * (trim + lowercase + dedup), filters obvious garbage, and caps the
 * list at 100 entries; returns the accepted count.
 */
export async function setShareAcl(code: string, emails: readonly string[]): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase client not available");
  const { data, error } = await supabase.rpc("set_share_acl", {
    p_code: code,
    p_emails: [...emails],
  });
  if (error) {
    captureError(error, { kind: "share_set_acl" });
    throw new Error(error.message);
  }
  return typeof data === "number" ? data : 0;
}

/**
 * Enumerate the ACL entries for one of the caller's shares.
 * Returns an empty array for shares the caller doesn't own.
 */
export async function listShareAcl(code: string): Promise<ShareAclEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase client not available");
  const { data, error } = await supabase.rpc("list_share_acl", { p_code: code });
  if (error) {
    captureError(error, { kind: "share_list_acl" });
    throw new Error(error.message);
  }
  return (data ?? []) as ShareAclEntry[];
}

/**
 * Soft-revoke a share. Idempotent. Returns true on first revoke,
 * false if the code was already revoked or never owned by the caller.
 */
export async function revokeShareLink(code: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase client not available");
  const { data, error } = await supabase.rpc("revoke_share_link", { p_code: code });
  if (error) {
    captureError(error, { kind: "share_revoke" });
    throw new Error(error.message);
  }
  return data === true;
}

export type FetchSharedTrailResult =
  | { access: "missing" }
  | { access: "restricted"; authenticated: boolean }
  | {
      access: "granted";
      code: string;
      label: string;
      rootUrl: string | null;
      rootTitle: string | null;
      nodeCount: number;
      snapshot: NavigationTreeJSON;
      createdAt: string;
      viewCount: number;
      visibility: ShareVisibility;
    };

/**
 * Pull a shared trail's snapshot via `get_shared_trail`. Three terminal
 * shapes:
 *   * `missing`     — code revoked / not found.
 *   * `restricted`  — share is private and caller isn't on the ACL.
 *   * `granted`     — full snapshot returned.
 *
 * Side-effect free: bump_share_view_count is called separately.
 */
export async function fetchSharedTrail(code: string): Promise<FetchSharedTrailResult> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase client not available");
  const { data, error } = await supabase.rpc("get_shared_trail", { p_code: code });
  if (error) {
    captureError(error, { kind: "share_get" });
    throw new Error(error.message);
  }
  if (!data) return { access: "missing" };
  const row = data as Record<string, unknown>;
  if (row.access === "restricted") {
    return {
      access: "restricted",
      authenticated: Boolean(row.authenticated),
    };
  }
  const granted = row as {
    code: string;
    label: string;
    root_url: string | null;
    root_title: string | null;
    node_count: number;
    snapshot: NavigationTreeJSON;
    created_at: string;
    view_count: number;
    visibility?: ShareVisibility;
  };
  return {
    access: "granted",
    code: granted.code,
    label: granted.label,
    rootUrl: granted.root_url,
    rootTitle: granted.root_title,
    nodeCount: granted.node_count,
    snapshot: granted.snapshot,
    createdAt: granted.created_at,
    viewCount: granted.view_count,
    visibility: granted.visibility ?? "public",
  };
}

/**
 * Best-effort view-count bump for a share. Rate-limited server-side to
 * one bump per (code, hour) bucket regardless of read volume — see
 * `bump_share_view_count` in migration 021. Swallows errors so a bump
 * failure never breaks the consumer flow.
 */
export async function bumpSharedTrailViewCount(code: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    await supabase.rpc("bump_share_view_count", { p_code: code });
  } catch {
    // best-effort: analytics-grade signal, not a critical path
  }
}

function mapImportError(messageRaw: string | null | undefined): ImportShareErrorCode {
  const msg = (messageRaw ?? "").toLowerCase();
  if (msg.includes("share_unavailable")) return "share-unavailable";
  if (msg.includes("share_self_import")) return "share-self-import";
  if (msg.includes("share_no_device")) return "share-no-device";
  return "unknown";
}

/**
 * Clone a shared trail into the caller's account. Atomic against
 * concurrent revoke via the RPC's `FOR SHARE` lock. Returns a
 * discriminated result rather than throwing so callers can branch
 * cleanly on the well-known error codes.
 */
export async function importSharedTrail(code: string): Promise<ImportShareResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: "unknown", message: "Supabase client not available" };
  }
  const { data, error } = await supabase.rpc("import_shared_trail", { p_code: code });
  if (error) {
    captureError(error, { kind: "share_import" });
    return {
      ok: false,
      error: mapImportError(error.message),
      message: error.message,
    };
  }
  const row = data as { trail_id: string; label: string; node_count: number } | null;
  if (!row?.trail_id) {
    return { ok: false, error: "unknown", message: "share_import_unexpected_response" };
  }
  return {
    ok: true,
    trailId: row.trail_id,
    label: row.label,
    nodeCount: row.node_count,
  };
}
