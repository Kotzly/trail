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
