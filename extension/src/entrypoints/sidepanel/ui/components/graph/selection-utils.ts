import type { NodeId } from "@shared/types/ids.js";

export type SelectionMode = "replace" | "add" | "remove";
type NodeIdLookup = { has(id: NodeId): boolean };

export function buildPreviewSelection(
  base: ReadonlySet<NodeId>,
  hits: ReadonlySet<NodeId>,
  mode: SelectionMode,
  activeIds: NodeIdLookup,
): Set<NodeId> {
  const preview = mode === "replace" ? new Set<NodeId>() : new Set<NodeId>(base);
  if (mode === "remove") {
    hits.forEach((id) => {
      if (!activeIds.has(id)) return;
      preview.delete(id);
    });
    return preview;
  }
  hits.forEach((id) => {
    if (!activeIds.has(id)) return;
    preview.add(id);
  });
  return preview;
}

export function diffSelection(
  prev: ReadonlySet<NodeId>,
  next: ReadonlySet<NodeId>,
): {
  added: Set<NodeId>;
  removed: Set<NodeId>;
  changedCount: number;
} {
  const added = new Set<NodeId>();
  const removed = new Set<NodeId>();
  next.forEach((id) => {
    if (!prev.has(id)) added.add(id);
  });
  prev.forEach((id) => {
    if (!next.has(id)) removed.add(id);
  });
  return {
    added,
    removed,
    changedCount: added.size + removed.size,
  };
}

export function shouldEmitPreview(prev: ReadonlySet<NodeId>, next: ReadonlySet<NodeId>): boolean {
  if (prev.size !== next.size) return true;
  for (const id of prev) {
    if (!next.has(id)) return true;
  }
  return false;
}
