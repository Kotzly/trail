import { lazy, Suspense, useCallback } from "react";
import FloatingControls from "./components/FloatingControls.js";
import RenameNodeDialog from "./components/RenameNodeDialog.js";
import SyncConflictToastMount from "./components/SyncConflictToast.js";
import OnboardingWizard from "./onboarding/OnboardingWizard.js";
import TourCoach from "./onboarding/tour/TourCoach.js";
import TourCelebration from "./onboarding/celebration/TourCelebration.js";
import TourCommitments from "./onboarding/cta/TourCommitments.js";
import OnboardingHintStrip from "./onboarding/hint-strip/OnboardingHintStrip.js";
import ContextMenus from "./components/ContextMenus.js";
import DeleteTreeConfirmModal from "./components/DeleteTreeConfirmModal.js";
import TrailLogo from "@ui/components/trail-logo";
import { Toaster } from "@ui/components/ui/sonner.js";
import { useAuthTransitionToast } from "./hooks/useAuthTransitionToast.js";
import { useBootstrap } from "./hooks/useBootstrap.js";
import { useRuntimeMessages } from "./hooks/useRuntimeMessages.js";
import { useShortcuts } from "./hooks/useShortcuts.js";
import { useThemeSync } from "./hooks/useThemeSync.js";
import { useStore } from "./state/store.js";
import { Button } from "@ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@ui/components/ui/empty";
import { TooltipProvider } from "@ui/components/ui/tooltip";
import type { NodeId, Url } from "@shared/types/ids.js";
import { navigateToNodeId } from "../api/tree.js";

const TrailGraph = lazy(() =>
  import("@features/graph/components/TrailGraph.js").then((m) => ({
    default: m.TrailGraph,
  })),
);

function BootstrapSkeleton() {
  return (
    <Empty className="h-full border-none">
      <EmptyHeader>
        <TrailLogo animated label="Loading Trail" />
        <EmptyTitle>Loading your trails</EmptyTitle>
        <EmptyDescription>Restoring your navigation graph…</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function DegradedBootstrap({ onRetry }: { onRetry: () => void }) {
  return (
    <Empty className="h-full border-none">
      <EmptyHeader>
        <EmptyMedia>
          <TrailLogo label="Trail" />
        </EmptyMedia>
        <EmptyTitle>Could not load Trail</EmptyTitle>
        <EmptyDescription>
          Something prevented Trail from starting. This is usually temporary.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </EmptyContent>
    </Empty>
  );
}

export default function App() {
  const { bootstrapStatus, retryBootstrap } = useBootstrap();
  useRuntimeMessages();
  useThemeSync();
  useShortcuts();
  useAuthTransitionToast();

  const treeJSON = useStore((s) => s.treeJSON);
  const precomputedPositions = useStore((s) => s.precomputedPositions);
  const settings = useStore((s) => s.settings);
  const currentNodeId = useStore((s) => s.currentNodeId);
  const openNodeIds = useStore((s) => s.openNodeIds);
  const nodeTabCounts = useStore((s) => s.nodeTabCounts);
  const collapsedNodeIds = useStore((s) => s.graph.collapsedNodeIds);
  const unfoldedChainIds = useStore((s) => s.graph.unfoldedChainIds);
  const selectedNodeIds = useStore((s) => s.graph.selectedNodeIds);
  const setSelectedNodeIds = useStore((s) => s.setSelectedNodeIds);
  const openContextMenu = useStore((s) => s.openContextMenu);
  const collapseNodes = useStore((s) => s.collapseNodes);
  const expandNodes = useStore((s) => s.expandNodes);
  const toggleChainUnfolded = useStore((s) => s.toggleChainUnfolded);
  const spotlight = useStore((s) => s.onboarding.spotlight);

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
        <SyncConflictToastMount />
        <FloatingControls />
        {settings && (
          <Suspense fallback={<BootstrapSkeleton />}>
            <TrailGraph
              tree={treeJSON}
              currentNodeId={currentNodeId}
              openNodeIds={openNodeIds}
              collapsedNodeIds={collapsedNodeIds}
              unfoldedChainIds={unfoldedChainIds}
              selectedNodeIds={selectedNodeIds}
              nodeTabCounts={nodeTabCounts}
              settings={settings}
              precomputedPositions={precomputedPositions}
              spotlight={spotlight}
              onNodeClick={handleNodeClick}
              onNodeContextMenu={handleNodeContextMenu}
              onCollapseToggle={handleCollapseToggle}
              onChainUnfoldToggle={toggleChainUnfolded}
              onSelectionChange={handleSelectionChange}
            />
          </Suspense>
        )}
        <DeleteTreeConfirmModal />
        <RenameNodeDialog />
        <OnboardingWizard />
        <TourCoach />
        <TourCelebration />
        <TourCommitments />
        <OnboardingHintStrip />
        <ContextMenus />
      </div>
    </TooltipProvider>
  );
}
