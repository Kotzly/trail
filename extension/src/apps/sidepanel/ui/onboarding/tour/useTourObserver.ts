/**
 * Observes the Zustand store and advances the tour state machine
 * whenever the current step's predicate matches. Also captures
 * transient facts (the first result child's id at the moment the
 * user clicks a result) so later steps have the right anchor.
 *
 * Why a subscription and not a derived state hook: predicates fire on
 * *transitions* (a node appeared, currentNodeId changed). React
 * render timing isn't the right place — we'd advance mid-render and
 * fight the lifecycle. A direct `useStore.subscribe` runs outside
 * render and can write back safely.
 */

import { useEffect, useRef } from "react";
import type { NodeId } from "@shared/types/ids.js";
import { onboardingStateItem } from "@shared/config/storage-items.js";
import {
  saveTourAnchors,
  setTourStep,
  setOnboardingPhase,
  completeOnboarding,
} from "../../../api/onboarding.js";
import { captureEvent } from "@shared/lib/observability.js";
import { useStore } from "../../state/store.js";
import {
  branchChildren,
  findBranchParent,
  onEnterSpotlight,
  stepAt,
  TOUR_STEP_COUNT,
  TOUR_STEP_PREDICATES,
  type TourStateSnapshot,
} from "./tour-machine.js";

/**
 * Advance the tour to a specific step index, applying the on-enter
 * spotlight and (when the final step is passed) transitioning to the
 * celebration phase. Shared by the observer's predicate-driven
 * advance AND the coach's button-driven advance (for user-confirmed
 * steps like `celebrateBranch`).
 *
 * `anchors` are read-only copies of the captured `firstResultChildId`
 * / `branchParentId` so callers without direct access to the
 * observer's refs (e.g. the coach's button) can still supply them.
 */
export async function advanceTourTo(
  nextIndex: number,
  anchors: { firstResultChildId: NodeId | null; branchParentId: NodeId | null },
): Promise<void> {
  if (nextIndex >= TOUR_STEP_COUNT) {
    await setOnboardingPhase("celebration");
    useStore.getState().setOnboarding({ phase: "celebration" });
    useStore.getState().setSpotlight(null, null);
    captureEvent("onboarding_tour_completed");
    return;
  }
  await setTourStep(nextIndex);
  useStore.getState().setOnboarding({ tourStep: nextIndex });
  const enterStep = stepAt(nextIndex);
  if (!enterStep) return;
  const state = useStore.getState();
  const snap: TourStateSnapshot = {
    treeJSON: state.treeJSON,
    currentNodeId: state.currentNodeId,
    firstResultChildId: anchors.firstResultChildId,
    branchParentId: anchors.branchParentId,
  };
  const spot = onEnterSpotlight(enterStep, snap);
  useStore.getState().setSpotlight(spot.nodeId, spot.kind);
}

export function useTourObserver(): void {
  // Captured facts outside React state so they survive across
  // subscription firings without triggering re-renders. Also
  // persisted to storage so a sidepanel close mid-tour can rehydrate
  // them on next mount — otherwise step 4 (returnToAbandoned)
  // becomes un-satisfiable because its predicate needs
  // `firstResultChildId` to match.
  const firstResultChildIdRef = useRef<NodeId | null>(null);
  const branchParentIdRef = useRef<NodeId | null>(null);

  // Rehydrate anchors from storage on mount. Keeps the observer
  // correct across sidepanel remounts.
  useEffect(() => {
    let cancelled = false;
    void onboardingStateItem.getValue().then((s) => {
      if (cancelled) return;
      if (s.tourFirstResultChildId) {
        firstResultChildIdRef.current = s.tourFirstResultChildId as NodeId;
      }
      if (s.tourBranchParentId) {
        branchParentIdRef.current = s.tourBranchParentId as NodeId;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Build a snapshot the machine can read. Pulled inside the
    // subscription so every store change re-evaluates.
    const buildSnapshot = (): TourStateSnapshot => {
      const s = useStore.getState();
      return {
        treeJSON: s.treeJSON,
        currentNodeId: s.currentNodeId,
        firstResultChildId: firstResultChildIdRef.current,
        branchParentId: branchParentIdRef.current,
      };
    };

    const tick = () => {
      const s = useStore.getState();
      if (s.onboarding.phase !== "tour") return;

      const stepIndex = s.onboarding.tourStep;
      const stepId = stepAt(stepIndex);
      if (!stepId) return;

      const snap = buildSnapshot();

      // On step 1 (clickResult) — once the user has clicked ANY
      // link, capture BOTH anchors at the same moment: the branch
      // parent (the page they clicked from) and its first child
      // (the link they opened). Later steps reference these ids.
      if (stepId === "clickResult") {
        const parent = findBranchParent(snap.treeJSON);
        const first = parent ? branchChildren(parent)[0] : null;
        if (parent && first) {
          if (branchParentIdRef.current === null) {
            branchParentIdRef.current = parent.id;
            void saveTourAnchors({ tourBranchParentId: parent.id as string });
          }
          if (firstResultChildIdRef.current === null) {
            firstResultChildIdRef.current = first.id;
            void saveTourAnchors({
              tourFirstResultChildId: first.id as string,
            });
          }
        }
      }

      const matches = TOUR_STEP_PREDICATES[stepId](snap);
      if (!matches) return;

      if (stepId === "clickAnother") {
        captureEvent("onboarding_tour_branched");
      }

      void advanceTourTo(stepIndex + 1, {
        firstResultChildId: firstResultChildIdRef.current,
        branchParentId: branchParentIdRef.current,
      });
    };

    // Subscribe to the two fields that trigger step transitions:
    // treeJSON (any tree mutation) and currentNodeId (navigation).
    const unsub = useStore.subscribe((state, prev) => {
      if (state.treeJSON === prev.treeJSON && state.currentNodeId === prev.currentNodeId) {
        return;
      }
      tick();
    });

    // Also tick once on mount — e.g. when the sidepanel resumes
    // mid-tour and the current state already satisfies the pending
    // step's predicate.
    tick();

    return unsub;
  }, []);

  // Phase-sync for spotlight:
  //   - When phase enters "tour" (first entry OR resume from
  //     tourDismissed), re-apply the spotlight for the current step
  //     so the node ring/target is visible even when we haven't
  //     advanced.
  //   - When phase leaves "tour" (dismiss / skip / celebration),
  //     clear lingering spotlight.
  const phase = useStore((s) => s.onboarding.phase);
  const tourStepIndex = useStore((s) => s.onboarding.tourStep);
  useEffect(() => {
    if (phase !== "tour") {
      useStore.getState().setSpotlight(null, null);
      return;
    }
    const stepId = stepAt(tourStepIndex);
    if (!stepId) return;
    const s = useStore.getState();
    const snap: TourStateSnapshot = {
      treeJSON: s.treeJSON,
      currentNodeId: s.currentNodeId,
      firstResultChildId: firstResultChildIdRef.current,
      branchParentId: branchParentIdRef.current,
    };
    const spot = onEnterSpotlight(stepId, snap);
    useStore.getState().setSpotlight(spot.nodeId, spot.kind);
  }, [phase, tourStepIndex]);

  // Auto-complete safety net: if somehow we land in "done" phase
  // without completedAt (edge case on skip paths), no-op. Completion
  // writes are the api's responsibility; kept here documented for
  // future maintainers.
  void completeOnboarding;
}
