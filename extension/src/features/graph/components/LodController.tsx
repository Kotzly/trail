/**
 * Projects the ReactFlow zoom level onto a `data-lod` attribute on a
 * target element, without re-rendering its children.
 *
 * Ambient and state effects (fades, shimmers, particle-toggles) can
 * read the attribute via CSS ancestor selectors — zero React subscription
 * per descendant. The selector is the tri-state `selectLod` which
 * changes only when zoom crosses a threshold, so this component itself
 * renders at most twice per zoom gesture.
 *
 * Mounts invisibly inside a `<ReactFlowProvider>` subtree.
 */

import { useEffect, type RefObject } from "react";
import { useStore } from "@xyflow/react";
import { selectLod } from "../lod.js";

export function LodController({ targetRef }: { targetRef: RefObject<HTMLElement | null> }): null {
  const lod = useStore(selectLod);
  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    el.setAttribute("data-lod", lod);
  }, [lod, targetRef]);
  return null;
}
