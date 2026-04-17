import type { NodeId, Timestamp } from "@shared/types/ids.js";
import { updateNodeData } from "@shared/types/node.js";
import type { NavigationTree } from "./nav-tree.js";

/**
 * Persist the last active visit timestamp and increment visit count for a node.
 * Returns true when the node data was updated.
 *
 * Fixes #79 (visit count silently dropped on mixed clocks):
 * - visitCount is now ALWAYS incremented on every call (a visit
 *   happened, regardless of whose clock stamped it).
 * - lastVisitedAt is only overwritten when the new timestamp is
 *   strictly newer than the existing one — this guard still
 *   protects against clock-skew regressions on the timestamp field,
 *   but no longer causes the count field to be dropped alongside.
 * - When the new timestamp is NOT finite (callers passing a bogus
 *   value), we still bump the count but leave the timestamp alone.
 */
export function markNodeVisited(tree: NavigationTree, nodeId: NodeId, at?: number): boolean {
  const node = tree.findNodeById(nodeId);
  if (!node) return false;

  const nextAtRaw = typeof at === "number" && Number.isFinite(at) ? Math.floor(at) : Date.now();
  const prevAtRaw =
    typeof node.data.lastVisitedAt === "number" && Number.isFinite(node.data.lastVisitedAt)
      ? Number(node.data.lastVisitedAt)
      : Number(node.timestamp);

  const timestampAdvances = Number.isFinite(nextAtRaw) && nextAtRaw > prevAtRaw;
  const prevCount = typeof node.data.visitCount === "number" ? node.data.visitCount : 0;

  node.data = updateNodeData(node.data, {
    ...(timestampAdvances ? { lastVisitedAt: nextAtRaw as Timestamp } : {}),
    visitCount: prevCount + 1,
  });
  return true;
}
