/**
 * Persistent onboarding coach — bottom-anchored card that narrates the
 * tour. Non-blocking: the graph remains fully interactive behind it.
 *
 * The coach is strictly a presenter. It reads the current step from
 * the store and renders its prompt + optional CTA. All "did they do
 * the thing?" logic lives in `useTourObserver` + `tour-machine`.
 */

import { useCallback, useEffect } from "react";
import type { NodeId } from "@shared/types/ids.js";
import { onboardingStateItem } from "@shared/config/storage-items.js";
import { i18n } from "#i18n";

/**
 * The generated `i18n.t` signature has multiple overloads, so
 * `Parameters<typeof i18n.t>[0]` resolves to `never`. We accept
 * any string here and cast at each `i18n.t(key as ...)` call site.
 */
type I18nKey = string;
type I18nArg = Parameters<typeof i18n.t>[0];
import { Icons } from "@ui/components/icons";
import { Button } from "@ui/components/ui/button";
import { Kbd, KbdGroup } from "@ui/components/ui/kbd";
import { cn } from "@ui/lib/utils";
import { dismissTour, setOnboardingPhase } from "../../../api/onboarding.js";
import { useStore } from "../../state/store.js";
import { advanceTourTo, useTourObserver } from "./useTourObserver.js";
import { stepAt, TOUR_STEP_COUNT, type TourStepId } from "./tour-machine.js";

type CoachContent = {
  titleKey: I18nKey;
  bodyKey: I18nKey;
  kbd?: { macKey: string; pcKey: string };
  cta?:
    | { kind: "advance"; labelKey: I18nKey }
    | { kind: "openUrl"; labelKey: I18nKey; url: string };
  /**
   * True when the step has no automatic predicate and the user must
   * click the CTA to advance. Celebrate steps use this so the success
   * state holds long enough to feel like a payoff instead of flashing
   * past on the same tick as detection.
   */
  userAdvance?: boolean;
};

const STEP_CONTENT: Record<TourStepId, CoachContent> = {
  arm: {
    titleKey: "onboarding.tour.arm.title",
    bodyKey: "onboarding.tour.arm.body",
    // Hands the user a guaranteed-content-rich landing page in a
    // fresh tab. Wikipedia's random-article endpoint always returns
    // something with plenty of outbound links — which the rest of
    // the tour needs (click a result, go back, branch).
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

export function TourCoach() {
  // Attach the observer. Stays mounted for the whole tour phase so
  // predicates always run.
  useTourObserver();

  const phase = useStore((s) => s.onboarding.phase);
  const tourStepIndex = useStore((s) => s.onboarding.tourStep);

  const visible = phase === "tour";
  const stepId = stepAt(tourStepIndex);
  const content = stepId ? STEP_CONTENT[stepId] : null;

  const handleSkip = useCallback(async () => {
    // Dismiss — preserves tour tree + step + anchors. User can resume
    // from the sidepanel hint strip. `completedAt` stays null.
    await dismissTour();
    useStore.getState().setOnboarding({ phase: "tourDismissed" });
    useStore.getState().setSpotlight(null, null);
  }, []);

  const handleEnd = useCallback(async () => {
    // User opted into the celebration early (rare; mostly for devs).
    await setOnboardingPhase("celebration");
    useStore.getState().setOnboarding({ phase: "celebration" });
    useStore.getState().setSpotlight(null, null);
  }, []);

  /**
   * Opens a curated URL in a new tab. Used by the "Pick for me" CTA
   * on the `arm` step — navigation via `chrome.tabs.create` reliably
   * triggers the background's nav tracker so the tour tree picks up
   * a root node, which is what the arm predicate watches for.
   */
  const handleOpenUrl = useCallback((url: string) => {
    try {
      void chrome.tabs.create({ url, active: true });
    } catch {
      // Best-effort — sidepanel can't always open tabs (e.g., detached
      // windows). User can fall back to typing a URL manually.
    }
  }, []);

  /**
   * Called by the "Cool" button on user-advance steps (currently
   * just `celebrateBranch`). Pulls anchors from storage so we work
   * whether or not the observer had already cached them in refs —
   * sidepanel-reopen scenario.
   */
  const handleUserAdvance = useCallback(async () => {
    const state = useStore.getState();
    const stored = await onboardingStateItem.getValue();
    const nextIndex = state.onboarding.tourStep + 1;
    await advanceTourTo(nextIndex, {
      firstResultChildId: (stored.tourFirstResultChildId as NodeId | null) ?? null,
      branchParentId: (stored.tourBranchParentId as NodeId | null) ?? null,
    });
  }, []);

  // Pressing Esc always offers a gentle exit — not an instant kill, so
  // an accidental keypress doesn't nuke the tour tree.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Simple confirm via browser dialog — cheap, unambiguous,
        // and matches the dismissiveness of other modal-free flows.
        if (window.confirm(i18n.t("onboarding.tour.confirmSkip"))) {
          void handleSkip();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, handleSkip]);

  if (!visible || !content) return null;

  const progressLabel = i18n.t("onboarding.tour.progress", [
    String(tourStepIndex + 1),
    String(TOUR_STEP_COUNT),
  ]);

  return (
    <div
      role="region"
      aria-label={i18n.t("onboarding.tour.regionAriaLabel")}
      className={cn(
        "pointer-events-auto absolute inset-x-3 bottom-3 z-40",
        "bg-card text-card-foreground ring-foreground/10 rounded-xl shadow-lg ring-1 backdrop-blur",
        "animate-in slide-in-from-bottom-2 fade-in-0 duration-300",
      )}
    >
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        <div className="bg-primary/15 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
          <Icons.Compass className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase">
            <span>{i18n.t("onboarding.tour.badge")}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{progressLabel}</span>
          </div>
          <h3 className="text-foreground mt-0.5 text-sm font-semibold tracking-tight">
            {i18n.t(content.titleKey as I18nArg)}
          </h3>
          <p
            key={`body-${stepId}`}
            className="text-muted-foreground animate-in fade-in-0 mt-1 text-[13px] leading-relaxed duration-200"
          >
            {i18n.t(content.bodyKey as I18nArg)}
          </p>
          {content.kbd ? (
            <KbdGroup className="mt-2">
              <Kbd>{isMac ? content.kbd.macKey : content.kbd.pcKey}</Kbd>
            </KbdGroup>
          ) : null}
          <div className="mt-3 flex items-center gap-2">
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
      </div>
      {/* Progress rail */}
      <div className="bg-border/50 h-0.5 w-full overflow-hidden rounded-b-xl">
        <div
          className="bg-primary h-full transition-[width] duration-500 ease-out"
          style={{ width: `${((tourStepIndex + 1) / TOUR_STEP_COUNT) * 100}%` }}
        />
      </div>
      {/* Dev-only tail: the celebration ship-out is reachable via
          observer on step 4; leave this on ghost so it's rarely seen. */}
      <button
        type="button"
        onClick={() => void handleEnd()}
        className="sr-only"
        aria-label="Force end tour"
      >
        end
      </button>
    </div>
  );
}

export default TourCoach;
