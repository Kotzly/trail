import { useCallback, useEffect, useRef, useState } from "react";
import "./onboarding.css";
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
import { useBoolean } from "@ui/hooks/use-boolean";
import { useLockFn } from "@ui/hooks/use-lock-fn";
import { useMount } from "@ui/hooks/use-mount";
import {
  advanceOnboarding,
  completeOnboarding,
  getOnboardingState,
  loadDemoTree,
  skipOnboarding,
  startOnboarding,
} from "../../api/onboarding.js";
import { showOperationError } from "../shared/show-operation-error.js";
import { StepDots } from "./components/StepDots.js";
import { WelcomeStep } from "./steps/WelcomeStep.js";
import { PrivacyStep } from "./steps/PrivacyStep.js";
import { BranchStep } from "./steps/BranchStep.js";
import { StartStep } from "./steps/StartStep.js";
import { ReadyStep } from "./steps/ReadyStep.js";

const TOTAL_STEPS = 5;

// Index constants for readability — matches the order of step components rendered below.
const STEP = {
  WELCOME: 0,
  PRIVACY: 1,
  BRANCH: 2,
  START: 3,
  READY: 4,
} as const;

// Visually hidden titles satisfy Radix Dialog's a11y contract without
// breaking the custom header layout. Each matches the on-screen h2 of
// the current step so screen readers announce the same content.
const STEP_TITLE_KEYS = {
  [0]: "onboarding.stepTitle.welcome",
  [1]: "onboarding.stepTitle.privacy",
  [2]: "onboarding.stepTitle.branch",
  [3]: "onboarding.stepTitle.start",
  [4]: "onboarding.stepTitle.ready",
} as const;

export default function OnboardingWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<number>(STEP.WELCOME);
  const [busy, busyActions] = useBoolean(false);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  useMount(() => {
    let cancelled = false;
    void getOnboardingState().then((state) => {
      if (cancelled) return;
      if (!state.seenWelcome) {
        setOpen(true);
        void startOnboarding();
      }
    });
    return () => {
      cancelled = true;
    };
  });

  const goToStep = useCallback(async (next: number) => {
    setStep(next);
    await advanceOnboarding(next);
  }, []);

  const handleSkip = useLockFn(async () => {
    await skipOnboarding();
    setOpen(false);
  });

  const handleDone = useLockFn(async () => {
    await completeOnboarding();
    setOpen(false);
  });

  const handleLoadDemo = useLockFn(async () => {
    busyActions.setTrue();
    try {
      await loadDemoTree();
      await goToStep(STEP.READY);
    } catch (error) {
      showOperationError(i18n.t("onboarding.loadDemoError"), error);
    } finally {
      busyActions.setFalse();
    }
  });

  const handleStartFresh = useCallback(async () => {
    if (busy) return;
    await goToStep(STEP.READY);
  }, [busy, goToStep]);

  const goNext = useCallback(async () => {
    if (busy) return;
    if (step < TOTAL_STEPS - 1) {
      await goToStep(step + 1);
    } else {
      await handleDone();
    }
  }, [busy, goToStep, handleDone, step]);

  const goBack = useCallback(async () => {
    if (busy || step === 0) return;
    await goToStep(step - 1);
  }, [busy, goToStep, step]);

  // Enter = primary action. Only when dialog is open, not busy, and not on
  // the Start step (which is a choice, not a single primary action).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (step === STEP.START) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      void goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, open, step]);

  // Re-focus the primary button on each step so Enter advances immediately
  // after motion settles. Skips the Start step, which has no primary.
  useEffect(() => {
    if (!open) return;
    if (step === STEP.START) return;
    const id = window.setTimeout(() => {
      primaryButtonRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(id);
  }, [open, step]);

  const isLast = step === TOTAL_STEPS - 1;
  const primaryLabel = isLast
    ? i18n.t("onboarding.primary.letsGo")
    : step === STEP.WELCOME
      ? i18n.t("onboarding.primary.showMore")
      : i18n.t("onboarding.primary.gotIt");

  const renderStep = () => {
    switch (step) {
      case STEP.WELCOME:
        return <WelcomeStep />;
      case STEP.PRIVACY:
        return <PrivacyStep />;
      case STEP.BRANCH:
        return <BranchStep />;
      case STEP.START:
        return (
          <StartStep
            onLoadDemo={() => void handleLoadDemo()}
            onStartFresh={() => void handleStartFresh()}
            loadingDemo={busy}
            disabled={busy}
          />
        );
      case STEP.READY:
        return <ReadyStep />;
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void handleSkip();
      }}
    >
      <DialogContent showCloseButton={false} className="max-w-[400px] gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{i18n.t(STEP_TITLE_KEYS[step as keyof typeof STEP_TITLE_KEYS])}</DialogTitle>
          <DialogDescription>
            {i18n.t("onboarding.stepDescription", [String(step + 1), String(TOTAL_STEPS)])}
          </DialogDescription>
        </DialogHeader>

        {/* Top bar: subtle logo glyph, dots, skip */}
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
          <div className="flex items-center gap-1.5">
            <TrailLogo variant="field" className="trail-logo-badge" aria-hidden />
            <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              Trail
            </span>
          </div>
          <StepDots total={TOTAL_STEPS} current={step} />
          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={busy}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm p-1 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            aria-label={i18n.t("onboarding.skipAriaLabel")}
          >
            <Icons.X className="size-3.5" />
          </button>
        </div>

        {/* Step body. A `key` on this wrapper forces React to unmount the
            previous step's tree and remount the new one, replaying the
            stagger each step owns internally. No wrapper animation —
            the per-step stagger is the transition. */}
        <div className="relative min-h-[280px] px-5 pt-2 pb-5">
          <div key={`step-${step}`}>{renderStep()}</div>
        </div>

        {/* Footer: back / primary. Start step has no primary — just back. */}
        <div className="border-border/60 bg-muted/30 flex items-center justify-between gap-2 border-t px-4 py-3">
          {step > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={busy}
              onClick={() => void goBack()}
              className="text-muted-foreground hover:text-foreground gap-1"
            >
              <Icons.ChevronLeft className="size-3.5" />
              {i18n.t("onboarding.back")}
            </Button>
          ) : (
            <span />
          )}
          {step !== STEP.START ? (
            <Button
              ref={primaryButtonRef}
              variant="default"
              size="sm"
              type="button"
              disabled={busy}
              onClick={() => void goNext()}
              className="gap-1"
            >
              {primaryLabel}
              {!isLast ? <Icons.ChevronRight className="size-3.5" /> : null}
            </Button>
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
