/**
 * Minimal mirror of the extension's NavigationTreeJSON shape that the
 * marketing viewer needs to render. Kept here, not pulled from the
 * extension, so marketing has no dependency on the WXT build graph.
 *
 * Server returns these via the `get_shared_trail` RPC. The shape is
 * stable per `snapshot_version` (1 today) — if the format evolves,
 * bump the version field and branch on it client-side.
 */

export type SharedTrailNode = {
  id: string;
  timestamp: number;
  data: {
    url: string;
    title: string;
    pinned: boolean;
    tags: string[];
  };
  children: SharedTrailNode[];
};

export type SharedTrailSnapshot = {
  root: SharedTrailNode | null;
  currentNodeId: string | null;
  nodeCount: number;
};

/**
 * Public identity block for the share's owner — populated by the
 * `get_shared_trail` RPC join against `public.users`. Email is
 * deliberately excluded; the public viewer only renders name + avatar.
 */
export type SharedTrailOwner = {
  name: string | null;
  imageUrl: string | null;
};

export type SharedTrailVisibility = "public" | "restricted";

export type SharedTrailDetail = {
  code: string;
  label: string;
  rootUrl: string | null;
  rootTitle: string | null;
  nodeCount: number;
  snapshot: SharedTrailSnapshot;
  snapshotVersion: number;
  createdAt: string;
  viewCount: number;
  visibility: SharedTrailVisibility;
  owner: SharedTrailOwner;
};

/**
 * Result of fetching a share by code. `granted` returns full detail.
 * `restricted` means the share exists but the caller isn't on the ACL —
 * the page renders a sign-in prompt without revealing any content.
 * `missing` covers both revoked and never-existed codes (intentionally
 * collapsed so existence doesn't leak).
 */
export type SharedTrailResult =
  | { access: "granted"; detail: SharedTrailDetail }
  | { access: "restricted"; authenticated: boolean }
  | { access: "missing" };
