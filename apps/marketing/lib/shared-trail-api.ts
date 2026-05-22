import "server-only";
import { createSupabaseServerClient } from "./supabase/server";
import type {
  SharedTrailDetail,
  SharedTrailSnapshot,
} from "./shared-trail-types";

/**
 * Fetch a shared trail from the public `get_shared_trail` RPC. Returns
 * `null` when the code is missing, revoked, or any error occurred —
 * the page renders the same 404 surface for all three to avoid
 * leaking existence vs. revocation status.
 *
 * Side-effect free: as of migration 021 the RPC no longer bumps
 * `view_count` (an anon UPDATE every call was a write-contention DoS
 * vector). Callers that want to record a view should call
 * `bumpSharedTrailViewCount` after the fetch — it is rate-limited
 * server-side and best-effort.
 */
export async function fetchSharedTrail(
  code: string,
): Promise<SharedTrailDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_shared_trail", {
    p_code: code,
  });
  if (error || !data) return null;
  const row = data as {
    code: string;
    label: string;
    root_url: string | null;
    root_title: string | null;
    node_count: number;
    snapshot: SharedTrailSnapshot;
    snapshot_version: number;
    created_at: string;
    view_count: number;
  };
  return {
    code: row.code,
    label: row.label,
    rootUrl: row.root_url,
    rootTitle: row.root_title,
    nodeCount: row.node_count,
    snapshot: row.snapshot,
    snapshotVersion: row.snapshot_version,
    createdAt: row.created_at,
    viewCount: row.view_count,
  };
}

/**
 * Best-effort view-count bump for a share. Rate-limited server-side to
 * one bump per (code, hour) bucket regardless of read volume — see
 * `bump_share_view_count` in migration 021. Swallows errors so a bump
 * failure never breaks page rendering.
 */
export async function bumpSharedTrailViewCount(code: string): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.rpc("bump_share_view_count", { p_code: code });
  } catch {
    // best-effort; analytics-grade signal, not a critical path
  }
}
