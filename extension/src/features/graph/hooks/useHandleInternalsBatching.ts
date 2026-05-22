import { useEffect, useRef } from "react";
import { useUpdateNodeInternals } from "@xyflow/react";
import type { TrailNode } from "../types.js";

/**
 * Batched handle-change detection. When the layout reshuffles handles
 * (e.g. layout-mode flip tree ↔ mindmap, or a first child landing
 * under a leaf that thereby gains a source handle), xyflow must
 * re-measure handles so incident edges land at the right endpoints.
 *
 * The per-node version of this effect — each TrailNode owning its own
 * useEffect + ref + updateNodeInternals call — fired N independent
 * store mutations in the same commit when a layout-mode change touched
 * many nodes. v12's `updateNodeInternals` accepts an array and
 * coalesces into a single store mutation, so we diff handles at the
 * parent and issue one batched call.
 *
 * Mount-skip: a node absent from `prev` is brand new. xyflow measures
 * its handles on the first commit using the initial node data, so we
 * must NOT call updateNodeInternals for it.
 */
export function useHandleInternalsBatching(nodes: TrailNode[]): void {
  const updateNodeInternals = useUpdateNodeInternals();
  const prevHandlesByIdRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const prev = prevHandlesByIdRef.current;
    const next = new Map<string, string>();
    const changed: string[] = [];
    for (const n of nodes) {
      const key = n.data.handles.join("|");
      next.set(n.id, key);
      const prevKey = prev.get(n.id);
      if (prevKey !== undefined && prevKey !== key) {
        changed.push(n.id);
      }
    }
    prevHandlesByIdRef.current = next;
    if (changed.length > 0) {
      updateNodeInternals(changed);
    }
  }, [nodes, updateNodeInternals]);
}
