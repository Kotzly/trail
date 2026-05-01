/**
 * Resume Tour popover — surfaces when the user dismissed the tour
 * mid-flow (`phase === "tourDismissed"`) and hasn't completed
 * onboarding. Reuses the same flying-popover treatment as
 * `<TourFlyingCoach>` so resuming feels like the tour was just paused
 * in place — the popover anchors to the node the dismissed step was
 * spotlighting (its branch parent or the abandoned first result).
 *
 * If the user dismissed before any spotlight existed (steps `arm` or
 * `clickResult`), `<FlyingPopover>` falls back to bottom-center.
 *
 * Mutex: `<OnboardingHintStrip>` no longer renders a `resume` surface,
 * so this component is the only place `phase === "tourDismissed"`
 * surfaces a CTA. The strip still owns the post-completion
 * `signin` / `pin` surfaces.
 *
 * Must mount inside a `<ReactFlow>` subtree (passed as `children` to
 * `<TrailGraph>`).
 */

import { useCallback, useEffect, useState } from "react";
import { i18n } from "#i18n";
import type { NodeId } from "@shared/types/ids.js";
import { onboardingStateItem } from "@shared/config/storage-items.js";
import { Icons } from "@ui/components/icons";
import { Button } from "@ui/components/ui/button";
import { captureEvent } from "@shared/lib/observability.js";
import {
  disposeTourTree,
  getOnboardingState,
  resumeTour,
  skipOnboarding,
} from "../../../api/onboarding.js";
import { useStore } from "../../state/store.js";
import { FlyingPopover } from "../flying/FlyingPopover.js";
import { onEnterSpotlight, stepAt, type TourStateSnapshot } from "./tour-machine.js";

export function ResumeTourPopover() {
  const phase = useStore((s) => s.onboarding.phase);
  const tourStepIndex = useStore((s) => s.onboarding.tourStep);
  const completedAt = useStore((s) => s.onboarding.completedAt);
  const treeJSON = useStore((s) => s.treeJSON);
  const currentNodeId = useStore((s) => s.currentNodeId);

  // Saved tour anchors (`firstResultChildId`, `branchParentId`) live
  // in storage — they survive sidepanel close. We only need them to
  // compute the resume-step spotlight, so a one-shot read is enough.
  const [anchors, setAnchors] = useState<{
    firstResultChildId: NodeId | null;
    branchParentId: NodeId | null;
  }>({ firstResultChildId: null, branchParentId: null });

  useEffect(() => {
    let cancelled = false;
    void onboardingStateItem.getValue().then((s) => {
      if (cancelled) return;
      setAnchors({
        firstResultChildId: (s.tourFirstResultChildId as NodeId | null) ?? null,
        branchParentId: (s.tourBranchParentId as NodeId | null) ?? null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fire `shown` exactly once per visibility stretch.
  const visible = phase === "tourDismissed" && completedAt == null;
  useEffect(() => {
    if (visible) {
      captureEvent("onboarding_soft_cta_shown", { surface: "resume" });
    }
  }, [visible]);

  const handleResume = useCallback(async () => {
    captureEvent("onboarding_soft_cta_clicked", { surface: "resume" });
    const stored = await getOnboardingState();
    const tourTreeId = stored.tourTreeId;
    const trees = useStore.getState().trees;
    const treeExists = Boolean(
      tourTreeId &&
      (trees.active?.id === tourTreeId || trees.others.some((t) => t.id === tourTreeId)),
    );
    const result = await resumeTour({ treeExists });
    if (result === "ok") {
      useStore.getState().setOnboarding({ phase: "tour" });
    } else {
      // Orphan path: tour tree was deleted out from under us. Mark
      // onboarding done so we don't keep nagging.
      useStore.getState().setOnboarding({ phase: "done", tourTreeId: null, tourStep: 0 });
    }
  }, []);

  const handleDismiss = useCallback(async () => {
    // Dismissing the resume CTA is effectively "I don't want to
    // finish the tour." Clean up the tour tree and mark onboarding
    // done — same finalisation the strip used to do.
    captureEvent("onboarding_soft_cta_dismissed", { surface: "resume" });
    await disposeTourTree();
    await skipOnboarding();
    useStore.getState().setOnboarding({ phase: "done", tourTreeId: null, tourStep: 0 });
  }, []);

  if (!visible) return null;

  // Recompute the spotlight target the dismissed step *would* have
  // applied. Anchors are read from storage; the rest of the snapshot
  // comes from the live store. If the step has no spotlight (early
  // steps), `nodeId` is null and the popover falls back to
  // bottom-center inside `<FlyingPopover>`.
  const stepId = stepAt(tourStepIndex);
  const snap: TourStateSnapshot = {
    treeJSON,
    currentNodeId,
    firstResultChildId: anchors.firstResultChildId,
    branchParentId: anchors.branchParentId,
  };
  const spot = stepId ? onEnterSpotlight(stepId, snap) : { nodeId: null, kind: null };
  const anchorNodeId = spot.nodeId;

  const header = (
    <>
      <Icons.Compass className="size-3" aria-hidden strokeWidth={1.75} />
      <span className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase">
        {i18n.t("onboarding.hintStrip.resume.title")}
      </span>
      <span className="ml-auto inline-flex items-center opacity-60" aria-hidden>
        <Icons.Move className="size-3" strokeWidth={1.75} />
      </span>
    </>
  );

  return (
    <FlyingPopover
      anchorNodeId={anchorNodeId}
      resetKey={`resume-${anchorNodeId ?? ""}`}
      ariaLabel={i18n.t("onboarding.hintStrip.regionAriaLabel")}
      header={header}
    >
      <div className="flex flex-col gap-1 px-4 pt-3 pb-3">
        <h3 className="text-foreground font-serif text-[16px] leading-snug font-normal tracking-tight">
          {i18n.t("onboarding.hintStrip.resume.title")}
        </h3>
        <p className="text-muted-foreground animate-in fade-in-0 max-w-[55ch] text-[13px] leading-relaxed duration-200 ease-(--ease-out)">
          {i18n.t("onboarding.hintStrip.resume.body")}
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => void handleResume()}>
            {i18n.t("onboarding.hintStrip.resume.cta")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void handleDismiss()}
            className="text-muted-foreground hover:text-foreground ml-auto"
            aria-label={i18n.t("onboarding.hintStrip.dismissAriaLabel")}
          >
            <Icons.X className="size-3.5" />
          </Button>
        </div>
      </div>
    </FlyingPopover>
  );
}

export default ResumeTourPopover;
