import { lazy, Suspense, useCallback } from "react";
import FloatingControls from "./components/FloatingControls.js";
import RenameNodeDialog from "./components/RenameNodeDialog.js";
import SyncConflictBanner from "./components/SyncConflictBanner.js";
import OnboardingWizard from "./onboarding/OnboardingWizard.js";
import ContextMenus from "./components/ContextMenus.js";
import DeleteTreeConfirmModal from "./components/DeleteTreeConfirmModal.js";
import TrailLogo from "@ui/components/trail-logo";
import { Toaster } from "@ui/components/ui/sonner.js";
import { useBootstrap } from "./hooks/useBootstrap.js";
import { useRuntimeMessages } from "./hooks/useRuntimeMessages.js";
import { useShortcuts } from "./hooks/useShortcuts.js";
import { useThemeSync } from "./hooks/useThemeSync.js";
import { useStore } from "./state/store.js";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Button } from "@ui/components/ui/button";
import { TooltipProvider } from "@ui/components/ui/tooltip";
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
    <div className="flex h-full flex-col gap-2.5 p-3">
      <Skeleton className="h-10 rounded-lg" />
      <Skeleton className="min-h-[200px] flex-1 rounded-lg" />
    </div>
  );
}

function DegradedBootstrap({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <TrailLogo label="Trail" />
      <h2 className="text-lg font-semibold">Could not load Trail</h2>
      <p className="text-muted-foreground max-w-[280px] text-[13px]">
        Something prevented Trail from starting. This is usually temporary.
      </p>
      <Button variant="outline" className="mt-2" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export default function App() {
  const { bootstrapStatus, retryBootstrap } = useBootstrap();
  useRuntimeMessages();
  useThemeSync();
  useShortcuts();

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

  const handleNodeClick = useCallback((nodeId: NodeId, url: string) => {
    void navigateToNodeId(nodeId, url as Url);
  }, []);

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
      <div className="relative flex h-dvh w-full max-w-none min-w-0 flex-col overflow-hidden">
        <Toaster />
        <BootstrapSkeleton />
      </div>
    );
  }

  if (bootstrapStatus === "degraded") {
    return (
      <div className="relative flex h-dvh w-full max-w-none min-w-0 flex-col overflow-hidden">
        <Toaster />
        <DegradedBootstrap onRetry={retryBootstrap} />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative flex h-dvh w-full max-w-none min-w-0 flex-col overflow-hidden">
        <Toaster />
        <SyncConflictBanner />
        <FloatingControls />
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
        <RenameNodeDialog />
        <OnboardingWizard />
        <ContextMenus />
      </div>
    </TooltipProvider>
  );
}
