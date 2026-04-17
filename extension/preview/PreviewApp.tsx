import { lazy, Suspense, useCallback, useEffect } from "react";
import FloatingControls from "@apps/sidepanel/ui/components/FloatingControls";
import RenameNodeDialog from "@apps/sidepanel/ui/components/RenameNodeDialog";
import SyncConflictBanner from "@apps/sidepanel/ui/components/SyncConflictBanner";
import ContextMenus from "@apps/sidepanel/ui/components/ContextMenus";
import DeleteTreeConfirmModal from "@apps/sidepanel/ui/components/DeleteTreeConfirmModal";
import { Toaster } from "@ui/components/ui/sonner";
import { Skeleton } from "@ui/components/ui/skeleton";
import { TooltipProvider } from "@ui/components/ui/tooltip";
import { useStore } from "@apps/sidepanel/ui/state/store";
import type { NodeId, Url } from "@shared/types/ids.js";

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

/**
 * Preview-only copy of App.tsx with the bootstrap/runtime-message/shortcut
 * hooks skipped. Store is pre-seeded with fake data in main.tsx, so we can
 * render the full graph + overlays against mocks.
 */
export function PreviewApp() {
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
    console.debug("[preview] node click", nodeId, url as Url);
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
      setSettings({ ...settings, layout: { ...settings.layout, mode } });
    },
    [settings, setSettings],
  );

  // Debug hotkeys so ContextMenus + other overlays are triggerable without
  // relying on xyflow's native right-click (works fine for real users, but
  // synthetic DOM events don't reach xyflow's React-synthetic handlers).
  // - c: open node context menu on current (id=3)
  // - r: open root node context menu (id=1)
  // - b: open bulk context menu (2 nodes selected)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tgt = e.target as HTMLElement;
      if (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA") return;
      const { openContextMenu, setSelectedNodeIds } = useStore.getState();
      if (e.key === "c" && currentNodeId) {
        openContextMenu({ type: "node", nodeId: currentNodeId, position: { x: 160, y: 200 } });
      } else if (e.key === "r") {
        openContextMenu({ type: "node", nodeId: 1 as NodeId, position: { x: 160, y: 100 } });
      } else if (e.key === "b") {
        const ids = new Set<NodeId>([2 as NodeId, 3 as NodeId]);
        setSelectedNodeIds(ids);
        openContextMenu({ type: "bulk", nodeIds: [...ids], position: { x: 160, y: 220 } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentNodeId]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="bg-background text-foreground relative flex h-dvh w-full max-w-none min-w-0 flex-col overflow-hidden">
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
        <ContextMenus />
      </div>
    </TooltipProvider>
  );
}
