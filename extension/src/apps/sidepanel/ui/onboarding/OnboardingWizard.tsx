/**
 * Onboarding wizard (v2). Sequential modal covering the first 5
 * screens of the Cal AI framework: Hook → Problem → Persona →
 * Solution → Features. Screen 5's primary CTA hands off to the
 * interactive tour: creates a dedicated "Trail tour" tree, switches
 * to it, and flips the onboarding phase to "tour".
 *
 * Everything after screen 5 (the tour itself, celebration, CTA) lives
 * outside this modal — the coach is a persistent card in the
 * sidepanel, not a dialog.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { i18n } from "#i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ui/components/ui/dialog";
import { Button } from "@ui/components/ui/button";
import { Icons } from "@ui/components/icons";
import TrailLogo from "@ui/components/trail-logo";
import { useLockFn } from "@ui/hooks/use-lock-fn";
import { useMount } from "@ui/hooks/use-mount";
import {
  bindTourTreeId,
  getOnboardingState,
  savePriorActiveTreeId,
  setOnboardingPersona,
  setOnboardingPhase,
  setWizardStep,
  skipOnboarding,
  startOnboarding,
  startTourTree,
} from "../../api/onboarding.js";
import { useStore } from "../state/store.js";
import type { OnboardingPersona } from "@shared/config/storage-items.js";
import { StepDots } from "./components/StepDots.js";
import { HookScreen } from "./wizard/HookScreen.js";
import { ProblemScreen } from "./wizard/ProblemScreen.js";
import { PersonaPickScreen } from "./wizard/PersonaPickScreen.js";
import { SolutionScreen } from "./wizard/SolutionScreen.js";
import { FeaturesScreen } from "./wizard/FeaturesScreen.js";

const TOTAL_STEPS = 5;

const STEP = {
  HOOK: 0,
  PROBLEM: 1,
  PERSONA: 2,
  SOLUTION: 3,
  FEATURES: 4,
} as const;

type StepIdx = (typeof STEP)[keyof typeof STEP];

const TITLE_KEYS = [
  "onboarding.v2.hook.title",
  "onboarding.v2.problem.title",
  "onboarding.v2.persona.title",
  "onboarding.v2.solution.research.title", // narrated variant is persona-tailored at runtime; this is the a11y title only
  "onboarding.v2.features.title",
] as const;

type I18nArg = Parameters<typeof i18n.t>[0];

export default function OnboardingWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<StepIdx>(STEP.HOOK);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  const persona = useStore((s) => s.onboarding.persona);

  // First-run check. Only opens the wizard when no one has seen the
  // welcome AND no tour is currently running (resume path: if phase is
  // "tour"/"celebration"/"cta", the coach / celebration handles it).
  useMount(() => {
    let cancelled = false;
    void getOnboardingState().then((state) => {
      if (cancelled) return;
      // Hydrate local store from storage so the rest of the UI can
      // react (coach appears, celebration renders, hint strip shows, etc.)
      useStore.getState().setOnboarding({
        phase: state.phase ?? null,
        wizardStep: state.wizardStep ?? 0,
        tourStep: state.tourStep ?? 0,
        persona: state.persona ?? null,
        tourTreeId: state.tourTreeId ?? null,
        startedAt: state.startedAt ?? null,
        completedAt: state.completedAt ?? null,
        softCtaDismissed: state.softCtaDismissed ?? {},
      });

      const alreadyDone = state.completedAt || state.phase === "done";
      if (alreadyDone) return;

      // If phase is already past the wizard, do not reopen the modal —
      // the coach/celebration/cta/hint-strip mount takes over.
      if (
        state.phase === "tour" ||
        state.phase === "tourDismissed" ||
        state.phase === "celebration" ||
        state.phase === "cta"
      ) {
        return;
      }

      if (!state.seenWelcome) {
        setOpen(true);
        setStep((state.wizardStep as StepIdx | undefined) ?? STEP.HOOK);
        void startOnboarding();
      } else if (state.phase === "wizard") {
        // Resume wizard mid-flow (sidepanel closed and reopened).
        setOpen(true);
        setStep((state.wizardStep as StepIdx | undefined) ?? STEP.HOOK);
      }
    });
    return () => {
      cancelled = true;
    };
  });

  const advance = useCallback(async (next: StepIdx) => {
    setStep(next);
    await setWizardStep(next);
    useStore.getState().setOnboarding({ wizardStep: next });
  }, []);

  const handleSkip = useLockFn(async () => {
    await skipOnboarding();
    useStore.getState().setOnboarding({ phase: "done" });
    setOpen(false);
  });

  const handlePickPersona = useCallback(
    async (p: OnboardingPersona) => {
      await setOnboardingPersona(p);
      useStore.getState().setOnboarding({ persona: p });
      // Auto-advance after a pick — the tile itself is the confirm.
      await advance(STEP.SOLUTION);
    },
    [advance],
  );

  const handleEnterTour = useLockFn(async () => {
    // Create an isolated tour tree and switch to it. `createNewTree`
    // returns void (no treeId), so we wait for the subsequent
    // tree-updated broadcast to flip `trees.active.id`. A
    // `setTimeout` would be a guess; subscribing until the id
    // actually changes is the correct form.
    const priorActiveId = useStore.getState().trees.active?.id ?? null;
    // Persist the prior id BEFORE creating the tour tree — the tree
    // we capture here is the one we'll switch back to on disposal.
    await savePriorActiveTreeId(priorActiveId);
    await startTourTree("Trail tour");

    const newActiveId = await new Promise<string | null>((resolve) => {
      const cap = useStore.getState().trees.active?.id ?? null;
      if (cap && cap !== priorActiveId) {
        resolve(cap);
        return;
      }
      const unsub = useStore.subscribe((state) => {
        const id = state.trees.active?.id ?? null;
        if (id && id !== priorActiveId) {
          unsub();
          resolve(id);
        }
      });
      // Defense-in-depth: resolve null after 3s so a stuck
      // broadcast doesn't hang the UI forever. `disposeTourTree` is
      // a no-op when id is null, which means the user may see a
      // lingering "Trail tour" tree — not ideal but not a crash.
      window.setTimeout(() => {
        unsub();
        resolve(null);
      }, 3000);
    });

    if (newActiveId) {
      await bindTourTreeId(newActiveId);
      useStore.getState().setOnboarding({ tourTreeId: newActiveId });
    }
    await setOnboardingPhase("tour");
    useStore.getState().setOnboarding({ phase: "tour", tourStep: 0 });
    setOpen(false);
  });

  const goNext = useCallback(async () => {
    switch (step) {
      case STEP.HOOK:
        await advance(STEP.PROBLEM);
        return;
      case STEP.PROBLEM:
        await advance(STEP.PERSONA);
        return;
      case STEP.PERSONA:
        // No primary button on this step — the tile pick auto-advances.
        return;
      case STEP.SOLUTION:
        await advance(STEP.FEATURES);
        return;
      case STEP.FEATURES:
        await handleEnterTour();
        return;
    }
  }, [advance, handleEnterTour, step]);

  const goBack = useCallback(async () => {
    if (step === STEP.HOOK) return;
    await advance((step - 1) as StepIdx);
  }, [advance, step]);

  // Enter advances on every step except persona (which is a choice).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (step === STEP.PERSONA) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      void goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, open, step]);

  // Re-focus the primary button on each step so Enter advances
  // immediately after the stagger settles.
  useEffect(() => {
    if (!open) return;
    if (step === STEP.PERSONA) return;
    const id = window.setTimeout(() => {
      primaryButtonRef.current?.focus();
    }, 140);
    return () => window.clearTimeout(id);
  }, [open, step]);

  // External phase escape: if something else (e.g. Settings→About
  // "replay onboarding") flips phase back to "wizard", reopen this
  // modal. Subscribe directly to the store (not via a `useStore`
  // selector + effect) — the transition event is the signal, not
  // the current value, so we set visibility inside the subscription
  // callback rather than during render.
  useEffect(() => {
    return useStore.subscribe((state, prev) => {
      if (state.onboarding.phase === "wizard" && prev.onboarding.phase !== "wizard") {
        setOpen(true);
      }
    });
  }, []);

  const primaryLabel = (() => {
    switch (step) {
      case STEP.HOOK:
        return i18n.t("onboarding.v2.hook.cta");
      case STEP.PROBLEM:
        return i18n.t("onboarding.v2.problem.cta");
      case STEP.SOLUTION:
        return i18n.t("onboarding.primary.gotIt");
      case STEP.FEATURES:
        return i18n.t("onboarding.v2.features.cta");
      default:
        return i18n.t("onboarding.primary.gotIt");
    }
  })();

  const renderStep = () => {
    switch (step) {
      case STEP.HOOK:
        return <HookScreen />;
      case STEP.PROBLEM:
        return <ProblemScreen />;
      case STEP.PERSONA:
        return <PersonaPickScreen selected={persona} onSelect={(p) => void handlePickPersona(p)} />;
      case STEP.SOLUTION:
        return <SolutionScreen persona={persona} />;
      case STEP.FEATURES:
        return <FeaturesScreen />;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void handleSkip();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[480px] max-w-[400px] flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{i18n.t(TITLE_KEYS[step] as I18nArg)}</DialogTitle>
          <DialogDescription>
            {i18n.t("onboarding.stepDescription", [String(step + 1), String(TOTAL_STEPS)])}
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 items-center justify-between gap-2 px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <TrailLogo variant="field" className="!h-[22px] !w-[22px]" aria-hidden />
            <span className="text-foreground/80 text-[13px] font-semibold tracking-tight">
              Trail
            </span>
          </div>
          <StepDots total={TOTAL_STEPS} current={step} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => void handleSkip()}
            className="text-muted-foreground hover:text-foreground"
            aria-label={i18n.t("onboarding.skipAriaLabel")}
          >
            <Icons.X className="size-3.5" />
          </Button>
        </div>

        <div className="relative flex-1 overflow-y-auto px-5 pt-2 pb-5">
          <div key={`step-${step}`}>{renderStep()}</div>
        </div>

        <div className="border-border/60 bg-muted/30 flex shrink-0 items-center justify-between gap-2 border-t px-4 py-3">
          {step > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => void goBack()}
              className="text-muted-foreground hover:text-foreground gap-1"
            >
              <Icons.ChevronLeft data-icon="inline-start" />
              {i18n.t("onboarding.back")}
            </Button>
          ) : (
            <span />
          )}
          {step !== STEP.PERSONA ? (
            <div className="flex items-center gap-2">
              {step === STEP.FEATURES ? (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => void handleSkip()}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {i18n.t("onboarding.v2.features.skipCta")}
                </Button>
              ) : null}
              <Button
                ref={primaryButtonRef}
                variant="default"
                size="sm"
                type="button"
                onClick={() => void goNext()}
                className="gap-1"
              >
                {primaryLabel}
                {step !== STEP.FEATURES ? <Icons.ChevronRight data-icon="inline-end" /> : null}
              </Button>
            </div>
          ) : (
            <span className="text-muted-foreground text-[11px]">
              {i18n.t("onboarding.pickOne")}
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
