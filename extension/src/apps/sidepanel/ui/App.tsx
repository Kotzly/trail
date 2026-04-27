import { lazy, Suspense, useCallback } from "react";
import { i18n } from "#i18n";
import FloatingControls from "./components/FloatingControls.js";
import SelectionActionBar from "./components/SelectionActionBar.js";
import SyncConflictToastMount from "./components/SyncConflictToast.js";
import OnboardingWizard from "./onboarding/OnboardingWizard.js";
import TourCoach from "./onboarding/tour/TourCoach.js";
import TourCelebration from "./onboarding/celebration/TourCelebration.js";
import TourCommitments from "./onboarding/cta/TourCommitments.js";
import OnboardingHintStrip from "./onboarding/hint-strip/OnboardingHintStrip.js";
import ContextMenus from "./components/ContextMenus.js";
import TrailLogo from "@ui/components/trail-logo";
import { Toaster } from "@ui/components/ui/sonner.js";
import { useAuthTransitionToast } from "./hooks/useAuthTransitionToast.js";
import { useAuthReset } from "./hooks/useAuthReset.js";
import { useBootstrap } from "./hooks/useBootstrap.js";
import { useClearButtonFocusOnBlur } from "./hooks/useClearButtonFocusOnBlur.js";
import { useRuntimeMessages } from "./hooks/useRuntimeMessages.js";
import { useShortcuts } from "./hooks/useShortcuts.js";
import { useThemeSync } from "./hooks/useThemeSync.js";
import { useThemePresetSync } from "./hooks/useThemePresetSync.js";
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
import { navigateToNodeId, renameNode, reparentNode } from "../api/tree.js";
import { showOperationError } from "./shared/show-operation-error.js";
import { captureEvent } from "@shared/lib/observability.js";

const TrailGraph = lazy(() =>
  import("@features/graph/components/TrailGraph.js").then((m) => ({
    default: m.TrailGraph,
  })),
);

function BootstrapSkeleton() {
  return (
    <Empty className="h-full border-none">
      <EmptyHeader>
        <TrailLogo animated label={i18n.t("sidepanel.bootstrap.loadingLogoLabel")} />
        <EmptyTitle>{i18n.t("sidepanel.bootstrap.loadingTitle")}</EmptyTitle>
        <EmptyDescription>{i18n.t("sidepanel.bootstrap.loadingDescription")}</EmptyDescription>
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
        <EmptyTitle>{i18n.t("sidepanel.bootstrap.errorTitle")}</EmptyTitle>
        <EmptyDescription>{i18n.t("sidepanel.bootstrap.errorDescription")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onRetry}>
          {i18n.t("sidepanel.bootstrap.retry")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

export default function App() {
  const { bootstrapStatus, retryBootstrap } = useBootstrap();
  const settings = useStore((s) => s.settings);
  useRuntimeMessages();
  useThemeSync(settings?.theme);
  useThemePresetSync(settings?.themePreset);
  useShortcuts();
  useAuthTransitionToast();
  useAuthReset();
  useClearButtonFocusOnBlur();

  const treeJSON = useStore((s) => s.treeJSON);
  const precomputedPositions = useStore((s) => s.precomputedPositions);
  const currentNodeId = useStore((s) => s.currentNodeId);
  const openNodeIds = useStore((s) => s.openNodeIds);
  const nodeTabCounts = useStore((s) => s.nodeTabCounts);
  const collapsedNodeIds = useStore((s) => s.graph.collapsedNodeIds);
  const collapseAction = useStore((s) => s.graph.collapseAction);
  const unfoldedChainIds = useStore((s) => s.graph.unfoldedChainIds);
  const badgeExpandedIds = useStore((s) => s.graph.badgeExpandedIds);
  const selectedNodeIds = useStore((s) => s.graph.selectedNodeIds);
  const setSelectedNodeIds = useStore((s) => s.setSelectedNodeIds);
  const openContextMenu = useStore((s) => s.openContextMenu);
  const collapseNodes = useStore((s) => s.collapseNodes);
  const expandNodes = useStore((s) => s.expandNodes);
  const toggleChainUnfolded = useStore((s) => s.toggleChainUnfolded);
  const toggleBadgeCollapse = useStore((s) => s.toggleBadgeCollapse);
  const spotlight = useStore((s) => s.onboarding.spotlight);
  const inlineRenameTargetId = useStore((s) => s.renameTarget);
  const startInlineRename = useStore((s) => s.startInlineRename);
  const cancelInlineRename = useStore((s) => s.cancelInlineRename);

  const handleNodeClick = useCallback((nodeId: NodeId, url: string) => {
    void navigateToNodeId(nodeId, url as Url);
  }, []);

  const handleInlineRenameCommit = useCallback(
    (nodeId: NodeId, title: string) => {
      cancelInlineRename();
      renameNode(nodeId, title)
        .then(() => captureEvent("node_renamed"))
        .catch((error) => showOperationError(i18n.t("sidepanel.operations.renameNode"), error));
    },
    [cancelInlineRename],
  );

  const handleReparentNode = useCallback((nodeId: NodeId, newParentId: NodeId) => {
    reparentNode(nodeId, newParentId)
      .then(() => captureEvent("node_reparented"))
      .catch((error) => showOperationError(i18n.t("sidepanel.operations.moveNode"), error));
  }, []);

  const handleNodeContextMenu = useCallback(
    (nodeId: NodeId, position: { x: number; y: number }) => {
      // Selection-aware routing:
      //  - If the right-clicked node is part of a multi-selection (≥2),
      //    open the bulk context menu — clicking on any selected node
      //    targets the whole group.
      //  - If the right-clicked node is NOT in the current selection,
      //    treat it as a focus switch: clear the stale selection and
      //    open the single-node menu.
      //  - Otherwise (no selection or single-selection that matches):
      //    open the single-node menu as before.
      const state = useStore.getState();
      const sel = state.graph.selectedNodeIds;
      if (sel.size >= 2 && sel.has(nodeId)) {
        openContextMenu({ type: "bulk", nodeIds: Array.from(sel), position });
        return;
      }
      if (sel.size > 0 && !sel.has(nodeId)) {
        state.clearSelection();
      }
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
        <Toaster position="top-center" />
        <BootstrapSkeleton />
      </div>
    );
  }

  if (bootstrapStatus === "degraded") {
    return (
      <div className="relative flex h-dvh w-full max-w-none min-w-0 flex-col overflow-hidden">
        <Toaster position="top-center" />
        <DegradedBootstrap onRetry={retryBootstrap} />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={150}>
      <div className="relative flex h-dvh w-full max-w-none min-w-0 flex-col overflow-hidden">
        <Toaster position="top-center" />
        <SyncConflictToastMount />
        <FloatingControls />
        <SelectionActionBar />
        {settings && (
          <Suspense fallback={<BootstrapSkeleton />}>
            <TrailGraph
              tree={treeJSON}
              currentNodeId={currentNodeId}
              openNodeIds={openNodeIds}
              collapsedNodeIds={collapsedNodeIds}
              collapseAction={collapseAction}
              unfoldedChainIds={unfoldedChainIds}
              badgeExpandedIds={badgeExpandedIds}
              selectedNodeIds={selectedNodeIds}
              nodeTabCounts={nodeTabCounts}
              settings={settings}
              precomputedPositions={precomputedPositions}
              spotlight={spotlight}
              inlineRenameTargetId={inlineRenameTargetId}
              onInlineRenameStart={startInlineRename}
              onInlineRenameCommit={handleInlineRenameCommit}
              onInlineRenameCancel={cancelInlineRename}
              onReparentNode={handleReparentNode}
              onNodeClick={handleNodeClick}
              onNodeContextMenu={handleNodeContextMenu}
              onCollapseToggle={handleCollapseToggle}
              onBadgeCollapseToggle={toggleBadgeCollapse}
              onChainUnfoldToggle={toggleChainUnfolded}
              onSelectionChange={handleSelectionChange}
            />
          </Suspense>
        )}
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
