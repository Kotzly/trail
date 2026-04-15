import { lazy, Suspense, useCallback, useRef } from "react";
import FloatingControls from "./components/FloatingControls.js";
import ContextMenus from "./components/ContextMenus.js";
import DeleteTreeConfirmModal from "./components/DeleteTreeConfirmModal.js";
import TrailLogo from "@ui/components/trail-logo";
import { Toaster } from "./components/ui/sonner.js";
import { useBootstrap } from "./hooks/useBootstrap.js";
import { useRuntimeMessages } from "./hooks/useRuntimeMessages.js";
import { useShortcuts } from "./hooks/useShortcuts.js";
import TooltipLayer from "./components/TooltipLayer.js";
import { useSystemThemeListener } from "./hooks/useSystemThemeListener.js";
import { useStore } from "./state/store.js";
import OnboardingHints from "./components/OnboardingHints.js";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Button } from "@ui/components/ui/button";
import { saveSettings } from "../api/settings.js";
import type { NodeId, Url } from "@shared/types/ids.js";
import { navigateToNodeId } from "../api/tree.js";

const TrailGraph = lazy(() =>
  import("@features/graph/components/TrailGraph.js").then((m) => ({
    default: m.TrailGraph,
  })),
);

function BootstrapSkeleton() {
  return (
    <div className="flex flex-col h-full p-3 gap-2.5">
      <Skeleton className="h-10 rounded-lg" />
      <Skeleton className="flex-1 min-h-[200px] rounded-lg" />
    </div>
  );
}

function DegradedBootstrap({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
      <TrailLogo label="Trail" />
      <h2 className="text-lg font-semibold">Could not load Trail</h2>
      <p className="text-[13px] text-muted-foreground max-w-[280px]">
        Something prevented Trail from starting. This is usually temporary.
      </p>
      <Button variant="outline" className="mt-2" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export default function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { bootstrapStatus, retryBootstrap } = useBootstrap();
  useRuntimeMessages();
  useSystemThemeListener();
  useShortcuts(searchInputRef);

  const treeJSON = useStore((s) => s.treeJSON);
  const precomputedPositions = useStore((s) => s.precomputedPositions);
  const settings = useStore((s) => s.settings);
  const currentNodeId = useStore((s) => s.currentNodeId);
  const openNodeIds = useStore((s) => s.openNodeIds);
  const nodeTabCounts = useStore((s) => s.nodeTabCounts);
  const collapsedNodeIds = useStore((s) => s.graph.collapsedNodeIds);
  const selectedNodeIds = useStore((s) => s.graph.selectedNodeIds);
  const setSelectedNodeIds = useStore((s) => s.setSelectedNodeIds);
  const openContextMenu = useStore((s) => s.openContextMenu);
  const collapseNodes = useStore((s) => s.collapseNodes);
  const expandNodes = useStore((s) => s.expandNodes);
  const setSettings = useStore((s) => s.setSettings);

  const handleNodeClick = useCallback(
    (nodeId: NodeId, url: string) => {
      void navigateToNodeId(nodeId, url as Url);
    },
    [],
  );

  const handleNodeContextMenu = useCallback(
    (nodeId: NodeId, position: { x: number; y: number }) => {
      openContextMenu({ type: "node", nodeId, position });
    },
    [openContextMenu],
  );

  const handleCollapseToggle = useCallback(
    (nodeId: NodeId) => {
      if (collapsedNodeIds.has(nodeId)) {
        expandNodes([nodeId]);
      } else {
        collapseNodes([nodeId]);
      }
    },
    [collapsedNodeIds, collapseNodes, expandNodes],
  );

  const handleSelectionChange = useCallback(
    (nodeIds: Set<NodeId>) => {
      setSelectedNodeIds(nodeIds);
    },
    [setSelectedNodeIds],
  );

  const handleLayoutModeChange = useCallback(
    (mode: "tree" | "mindmap") => {
      if (!settings) return;
      const next = { ...settings, layout: { ...settings.layout, mode } };
      setSettings(next);
      saveSettings(next).catch(console.error);
    },
    [settings, setSettings],
  );

  if (bootstrapStatus === "loading") {
    return (
      <div className="flex flex-col h-dvh w-full max-w-none min-w-0 overflow-hidden relative">
        <Toaster />
        <BootstrapSkeleton />
      </div>
    );
  }

  if (bootstrapStatus === "degraded") {
    return (
      <div className="flex flex-col h-dvh w-full max-w-none min-w-0 overflow-hidden relative">
        <Toaster />
        <DegradedBootstrap onRetry={retryBootstrap} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh w-full max-w-none min-w-0 overflow-hidden relative">
      <Toaster />
      <FloatingControls searchInputRef={searchInputRef} />
      <OnboardingHints />
      {settings && (
        <Suspense fallback={<BootstrapSkeleton />}>
          <TrailGraph
            tree={treeJSON}
            currentNodeId={currentNodeId}
            openNodeIds={openNodeIds}
            collapsedNodeIds={collapsedNodeIds}
            selectedNodeIds={selectedNodeIds}
            nodeTabCounts={nodeTabCounts}
            settings={settings}
            precomputedPositions={precomputedPositions}
            onNodeClick={handleNodeClick}
            onNodeContextMenu={handleNodeContextMenu}
            onCollapseToggle={handleCollapseToggle}
            onSelectionChange={handleSelectionChange}
            onLayoutModeChange={handleLayoutModeChange}
          />
        </Suspense>
      )}
      <DeleteTreeConfirmModal />
      <ContextMenus />
      <TooltipLayer />
    </div>
  );
}
