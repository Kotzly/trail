import { useQuery } from "@tanstack/react-query";
import { sendRpcMessage } from "@shared/rpc/client.js";
import { rpc, type TreesSnapshot } from "@shared/rpc/contracts.js";
import type { TreeSummary, ArchiveIndexEntry } from "@shared/types/tree.js";

export type LocalTrailSummary = TreeSummary & {
  source: "active" | "archived";
};

function toTrailSummary(
  entry: ArchiveIndexEntry,
  source: "active" | "archived",
): LocalTrailSummary {
  return { ...entry, source };
}

function mergeTrails(snapshot: TreesSnapshot): LocalTrailSummary[] {
  const active = toTrailSummary(
    {
      ...snapshot.active,
      nodeCount: 0,
      savedAt: snapshot.active.createdAt,
    },
    "active",
  );

  const archived = snapshot.archived.map((entry) => toTrailSummary(entry, "archived"));

  return [active, ...archived];
}

async function fetchTrails(): Promise<LocalTrailSummary[]> {
  const response = await sendRpcMessage(rpc.getTrees());
  if (!response.success) {
    throw new Error(response.error);
  }
  return mergeTrails(response.data);
}

export function useLocalTrails() {
  const query = useQuery({
    queryKey: ["local-trails"],
    queryFn: fetchTrails,
  });

  return {
    trails: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
