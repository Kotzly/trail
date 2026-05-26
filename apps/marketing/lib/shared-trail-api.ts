import "server-only";
import { createSupabaseServerClient } from "./supabase/server";
import type {
  SharedTrailResult,
  SharedTrailSnapshot,
} from "./shared-trail-types";

type GrantedRow = {
  access: "granted";
  visibility: "public" | "restricted";
  code: string;
  label: string;
  root_url: string | null;
  root_title: string | null;
  node_count: number;
  snapshot: SharedTrailSnapshot;
  snapshot_version: number;
  created_at: string;
  view_count: number;
  owner_name: string | null;
  owner_image_url: string | null;
};

type RestrictedRow = {
  access: "restricted";
  authenticated: boolean;
};

/**
 * Fetch a shared trail from the `get_shared_trail` RPC. The RPC
 * collapses three failure modes into a single NULL response — missing
 * code, revoked share, and unknown error — so the page can render the
 * same 404 surface for all three (existence-leak resistance).
 *
 * A second branch, `access: "restricted"`, signals that the share
 * exists but the caller isn't on its ACL. The page renders a sign-in
 * prompt without revealing any trail content.
 *
 * Side-effect free: bump_share_view_count is called separately.
 */
export async function fetchSharedTrail(
  code: string,
): Promise<SharedTrailResult> {
  const supabase = await createSupabaseServerClient();
  // `/s/<code>` is excluded from the next-intl middleware (locale-
  // agnostic short URLs), so the usual @supabase/ssr cookie-refresh
  // never runs for this route. Call getUser() first to force the
  // client to refresh an expired access token in-memory — otherwise a
  // signed-in viewer whose token lapsed would hit the RPC as `anon`,
  // get the restricted sentinel, and be wrongly bounced to the
  // sign-in gate for a share they're actually allowed to see. The RPC
  // below shares this client instance, so it carries the refreshed JWT.
  // (In a Server Component the refreshed cookie can't be persisted —
  // server.ts swallows that — so this re-refreshes per request, which
  // is correct if slightly chatty.)
  await supabase.auth.getUser();
  const { data, error } = await supabase.rpc("get_shared_trail", {
    p_code: code,
  });
  if (error || !data) return { access: "missing" };

  // Legacy callers received the granted shape with no `access` field.
  // Treat that as granted-public so a partial migration window (RPC
  // upgraded, marketing not yet rebuilt — or vice versa) doesn't
  // 404 every share.
  const row = data as Partial<GrantedRow> & Partial<RestrictedRow>;
  if (row.access === "restricted") {
    return {
      access: "restricted",
      authenticated: Boolean((row as RestrictedRow).authenticated),
    };
  }
  const granted = row as GrantedRow;
  return {
    access: "granted",
    detail: {
      code: granted.code,
      label: granted.label,
      rootUrl: granted.root_url,
      rootTitle: granted.root_title,
      nodeCount: granted.node_count,
      snapshot: granted.snapshot,
      snapshotVersion: granted.snapshot_version,
      createdAt: granted.created_at,
      viewCount: granted.view_count,
      visibility: granted.visibility ?? "public",
      owner: {
        name: granted.owner_name ?? null,
        imageUrl: granted.owner_image_url ?? null,
      },
    },
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
    // Refresh first (same reason as fetchSharedTrail) so a restricted
    // share's bump runs with the viewer's identity and the RPC's ACL
    // check passes — otherwise allowlisted views of private shares
    // would never increment the counter.
    await supabase.auth.getUser();
    await supabase.rpc("bump_share_view_count", { p_code: code });
  } catch {
    // best-effort; analytics-grade signal, not a critical path
  }
}
