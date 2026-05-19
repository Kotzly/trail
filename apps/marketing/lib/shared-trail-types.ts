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
};
