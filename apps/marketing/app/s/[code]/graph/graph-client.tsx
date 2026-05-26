"use client";

import dynamic from "next/dynamic";
import type { SharedTrailNode } from "@/lib/shared-trail-types";

/**
 * Client-only loader for the shared-trail graph. `ssr: false` keeps the
 * ~80 KB of `@xyflow/react` + `d3-hierarchy` off the server and — more
 * importantly — means the graph is never server-rendered and hydrated.
 * Like the extension's panel, it mounts purely on the client, so the only
 * nodes ever created are the ones the viewport culls in. (`ssr: false`
 * isn't allowed in a Server Component, hence this wrapper.)
 */
const SharedTrailGraph = dynamic(
  () =>
    import("./shared-trail-graph").then((m) => ({
      default: m.SharedTrailGraph,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[640px] w-full animate-pulse rounded-lg border bg-muted/30" />
    ),
  },
);

export function GraphClient(props: {
  root: SharedTrailNode;
  currentNodeId?: string | null;
}) {
  return <SharedTrailGraph {...props} />;
}
