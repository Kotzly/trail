import { useEffect, useRef, useState } from "react";
import type { NodeId } from "@shared/types/ids.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { Settings } from "@shared/types/settings.js";
import type { LayoutResult } from "../types.js";
import { computeLayout, type LayoutMetadata } from "../layout.js";

type UseGraphLayoutInput = {
  tree: NavigationTreeJSON | null;
  settings: Settings;
  collapsedNodeIds: Set<NodeId>;
  metadata: LayoutMetadata;
  precomputedPositions?: Record<string, { x: number; y: number }> | null | undefined;
};

export function useGraphLayout(input: UseGraphLayoutInput): LayoutResult {
  const [result, setResult] = useState<LayoutResult>({ nodes: [], edges: [] });
  const versionRef = useRef(0);

  useEffect(() => {
    const version = ++versionRef.current;

    computeLayout(
      input.tree,
      input.settings,
      input.collapsedNodeIds,
      input.metadata,
      input.precomputedPositions,
    )
      .then((layoutResult) => {
        if (versionRef.current === version) {
          setResult(layoutResult);
        }
      })
      .catch((err) => {
        console.error("Layout computation failed:", err);
      });
  }, [
    input.tree,
    input.settings,
    input.collapsedNodeIds,
    input.metadata,
    input.precomputedPositions,
  ]);

  return result;
}
