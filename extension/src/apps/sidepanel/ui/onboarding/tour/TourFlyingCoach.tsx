/**
 * Flying tour coach — narrates the interactive onboarding tour from
 * inside a draggable popover that anchors to the spotlighted node.
 *
 * The anchoring + drag mechanics live in `<FlyingPopover>`; this file
 * is responsible for the tour-specific content (per-step copy, CTAs,
 * progress, ESC confirmation), the observer mount, and translating
 * tour state into a popover anchor + reset key.
 *
 * Must mount inside a `<ReactFlow>` subtree (passed as `children` to
 * `<TrailGraph>`).
 */

import { useCallback, useEffect, useState } from "react";
import type { NodeId } from "@shared/types/ids.js";
import { onboardingStateItem } from "@shared/config/storage-items.js";
import { i18n } from "#i18n";
import { Icons } from "@ui/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ui/components/ui/alert-dialog";
import { Button } from "@ui/components/ui/button";
import { Kbd, KbdGroup } from "@ui/components/ui/kbd";
import { Progress } from "@ui/components/ui/progress";
import { dismissTour, setOnboardingPhase } from "../../../api/onboarding.js";
import { useStore } from "../../state/store.js";
import { FlyingPopover } from "../flying/FlyingPopover.js";
import { advanceTourTo, useTourObserver } from "./useTourObserver.js";
import { stepAt, TOUR_STEP_COUNT, type TourStepId } from "./tour-machine.js";

type I18nKey = string;
type I18nArg = Parameters<typeof i18n.t>[0];

type CoachContent = {
  titleKey: I18nKey;
  bodyKey: I18nKey;
  kbd?: { macKey: string; pcKey: string };
  cta?:
    | { kind: "advance"; labelKey: I18nKey }
    | { kind: "openUrl"; labelKey: I18nKey; url: string };
  /** True when the step has no automatic predicate; user clicks CTA to advance. */
  userAdvance?: boolean;
};

const STEP_CONTENT: Record<TourStepId, CoachContent> = {
  arm: {
    titleKey: "onboarding.tour.arm.title",
    bodyKey: "onboarding.tour.arm.body",
    cta: {
      kind: "openUrl",
      labelKey: "onboarding.tour.arm.pickForMeCta",
      url: "https://en.wikipedia.org/wiki/Special:Random",
    },
  },
  clickResult: {
    titleKey: "onboarding.tour.clickResult.title",
    bodyKey: "onboarding.tour.clickResult.body",
  },
  goBack: {
    titleKey: "onboarding.tour.goBack.title",
    bodyKey: "onboarding.tour.goBack.body",
    kbd: { macKey: "⌘ ←", pcKey: "Alt ←" },
  },
  clickAnother: {
    titleKey: "onboarding.tour.clickAnother.title",
    bodyKey: "onboarding.tour.clickAnother.body",
  },
  celebrateBranch: {
    titleKey: "onboarding.tour.celebrateBranch.title",
    bodyKey: "onboarding.tour.celebrateBranch.body",
    cta: { kind: "advance", labelKey: "onboarding.tour.celebrateBranch.cta" },
    userAdvance: true,
  },
  returnToAbandoned: {
    titleKey: "onboarding.tour.returnToAbandoned.title",
    bodyKey: "onboarding.tour.returnToAbandoned.body",
  },
};

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

export function TourFlyingCoach() {
  // Observer drives all step transitions. Mounted here because this is
  // the place that exists for the entire tour lifetime.
  useTourObserver();

  const phase = useStore((s) => s.onboarding.phase);
  const tourStepIndex = useStore((s) => s.onboarding.tourStep);
  const spotlightId = useStore((s) => s.onboarding.spotlight.nodeId);

  const visible = phase === "tour";
  const stepId = stepAt(tourStepIndex);
  const content = stepId ? STEP_CONTENT[stepId] : null;

  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSkip = useCallback(async () => {
    await dismissTour();
    useStore.getState().setOnboarding({ phase: "tourDismissed" });
    useStore.getState().setSpotlight(null, null);
  }, []);

  const handleEnd = useCallback(async () => {
    await setOnboardingPhase("celebration");
    useStore.getState().setOnboarding({ phase: "celebration" });
    useStore.getState().setSpotlight(null, null);
  }, []);

  const handleOpenUrl = useCallback((url: string) => {
    try {
      void chrome.tabs.create({ url, active: true });
    } catch {
      // Best-effort: detached side-panel windows can't open tabs;
      // user can fall back to typing a URL manually.
    }
  }, []);

  const handleUserAdvance = useCallback(async () => {
    const state = useStore.getState();
    const stored = await onboardingStateItem.getValue();
    const nextIndex = state.onboarding.tourStep + 1;
    await advanceTourTo(nextIndex, {
      firstResultChildId: (stored.tourFirstResultChildId as NodeId | null) ?? null,
      branchParentId: (stored.tourBranchParentId as NodeId | null) ?? null,
    });
  }, []);

  // Esc → soft confirmation. Routed through shadcn AlertDialog rather
  // than `window.confirm` so the dismiss prompt stays inside Trail's
  // visual language.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirmOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  const confirmDialog = (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {i18n.t("onboarding.tour.confirmSkipTitle" as I18nArg)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {i18n.t("onboarding.tour.confirmSkipBody" as I18nArg)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {i18n.t("onboarding.tour.confirmSkipCancel" as I18nArg)}
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void handleSkip()}>
            {i18n.t("onboarding.tour.confirmSkipConfirm" as I18nArg)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (!visible || !content) {
    return confirmDialog;
  }

  const progressLabel = i18n.t("onboarding.tour.progress", [
    String(tourStepIndex + 1),
    String(TOUR_STEP_COUNT),
  ]);

  const header = (
    <>
      <Icons.Compass className="size-3" aria-hidden strokeWidth={1.75} />
      <span className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase">
        {i18n.t("onboarding.tour.badge")}
      </span>
      <span aria-hidden>·</span>
      <span className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase tabular-nums">
        {progressLabel}
      </span>
      <span className="ml-auto inline-flex items-center opacity-60" aria-hidden>
        <Icons.Move className="size-3" strokeWidth={1.75} />
      </span>
    </>
  );

  return (
    <>
      <FlyingPopover
        anchorNodeId={spotlightId}
        resetKey={`tour-${tourStepIndex}|${spotlightId ?? ""}`}
        ariaLabel={i18n.t("onboarding.tour.regionAriaLabel")}
        header={header}
        footer={
          <Progress
            value={((tourStepIndex + 1) / TOUR_STEP_COUNT) * 100}
            className="h-0.5 w-full"
          />
        }
      >
        <div className="flex flex-col gap-1 px-4 pt-3 pb-3">
          <h3 className="text-foreground font-serif text-[16px] leading-snug font-normal tracking-tight">
            {i18n.t(content.titleKey as I18nArg)}
          </h3>
          <p
            key={`body-${stepId}`}
            className="text-muted-foreground animate-in fade-in-0 max-w-[55ch] text-[13px] leading-relaxed duration-200 ease-(--ease-out)"
          >
            {i18n.t(content.bodyKey as I18nArg)}
          </p>
          {content.kbd ? (
            <KbdGroup className="mt-1">
              <Kbd>{isMac ? content.kbd.macKey : content.kbd.pcKey}</Kbd>
            </KbdGroup>
          ) : null}
          <div className="mt-2.5 flex items-center gap-2">
            {content.cta?.kind === "advance" ? (
              <Button type="button" size="sm" onClick={() => void handleUserAdvance()}>
                {i18n.t(content.cta.labelKey as I18nArg)}
              </Button>
            ) : null}
            {content.cta?.kind === "openUrl" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (content.cta?.kind === "openUrl") handleOpenUrl(content.cta.url);
                }}
              >
                {i18n.t(content.cta.labelKey as I18nArg)}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void handleSkip()}
              className="text-muted-foreground hover:text-foreground ml-auto"
            >
              {i18n.t("onboarding.tour.skip")}
            </Button>
          </div>
        </div>
        {/* Dev-only escape: reachable via the observer on the final step. */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => void handleEnd()}
          className="sr-only"
          aria-label="Force end tour"
        >
          end
        </Button>
      </FlyingPopover>
      {confirmDialog}
    </>
  );
}

export default TourFlyingCoach;
