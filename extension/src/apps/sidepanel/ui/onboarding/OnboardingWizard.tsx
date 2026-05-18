/**
 * Onboarding wizard. Five-screen modal: Hook → Problem → Persona →
 * Solution → Features. The final screen's primary CTA finalizes
 * onboarding (no interactive tour, no tree switch — the user's tabs
 * and existing tree stay exactly where they are). Skip is terminal at
 * every step: closing the modal or hitting Skip flips phase to
 * "done" and onboarding never reopens unless the user replays it
 * from Settings → About.
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
  completeOnboarding,
  getOnboardingState,
  setOnboardingPersona,
  setWizardStep,
  skipOnboarding,
  startOnboarding,
} from "../../api/onboarding.js";
import { useStore } from "../state/store.js";
import {
  INITIAL_ONBOARDING_STATE,
  onboardingStateItem,
  type OnboardingPersona,
} from "@shared/config/storage-items.js";
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

  // First-run check + one-time migration for users mid-flight from the
  // old phase machine (tour / tourDismissed / celebration / cta). The
  // tour was removed; anyone caught mid-tour with seenWelcome already
  // set should just land in `done` so they don't see a stuck UI.
  useMount(() => {
    let cancelled = false;
    void getOnboardingState().then(async (raw) => {
      if (cancelled) return;

      let state = raw;
      const deadPhases = ["tour", "tourDismissed", "celebration", "cta"] as const;
      if (state.phase && (deadPhases as readonly string[]).includes(state.phase)) {
        // Full overwrite so the now-removed tour fields (tourTreeId,
        // priorActiveTreeId, etc.) don't linger in storage on every
        // subsequent merge-style save.
        const next = state.seenWelcome
          ? {
              ...INITIAL_ONBOARDING_STATE,
              seenWelcome: true,
              persona: state.persona ?? null,
              completedAt: state.completedAt ?? Date.now(),
              phase: "done" as const,
              startedAt: state.startedAt ?? null,
            }
          : INITIAL_ONBOARDING_STATE;
        await onboardingStateItem.setValue(next);
        state = next;
      }

      // Hydrate local store from storage so the rest of the UI can react.
      useStore.getState().setOnboarding({
        phase: state.phase ?? null,
        wizardStep: state.wizardStep ?? 0,
        persona: state.persona ?? null,
        startedAt: state.startedAt ?? null,
        completedAt: state.completedAt ?? null,
      });

      const alreadyDone = state.completedAt || state.phase === "done";
      if (alreadyDone) return;

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

  const handleFinish = useLockFn(async () => {
    await completeOnboarding();
    useStore.getState().setOnboarding({ phase: "done", completedAt: Date.now() });
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
        await handleFinish();
        return;
    }
  }, [advance, handleFinish, step]);

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

  // External phase escape: if something else (e.g. Settings → About
  // "replay onboarding") flips phase back to "wizard", reopen the modal.
  useEffect(() => {
    return useStore.subscribe((state, prev) => {
      if (state.onboarding.phase === "wizard" && prev.onboarding.phase !== "wizard") {
        setOpen(true);
        setStep(STEP.HOOK);
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
        data-testid="onboarding-wizard"
        className="flex h-[480px] max-h-[calc(100dvh-2rem)] max-w-[400px] flex-col gap-0 overflow-hidden p-0"
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
            data-testid="onboarding-skip"
          >
            <Icons.X className="size-3.5" />
          </Button>
        </div>

        <div className="relative flex-1 overflow-y-auto px-5 pt-2 pb-5">
          <div key={`step-${step}`} className="h-full">
            {renderStep()}
          </div>
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
              <Button
                ref={primaryButtonRef}
                variant="default"
                size="sm"
                type="button"
                onClick={() => void goNext()}
                className="gap-1"
                data-testid="onboarding-next"
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
