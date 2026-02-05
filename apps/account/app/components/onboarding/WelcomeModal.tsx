"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRightIcon,
  CheckIcon,
  DownloadIcon,
  MousePointerClickIcon,
  ShareIcon,
  SparklesIcon,
  TargetIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@trail/ui";
import { cn } from "@trail/ui";
import Link from "next/link";

export type TutorialStep = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  illustration?: React.ReactNode;
};

export type WelcomeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSkip?: () => void;
  onComplete?: () => void;
  userName?: string;
};

const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "welcome to trail",
    description:
      "capture your workflows, organize them automatically, and share insights with your team.",
    icon: <SparklesIcon className="h-5 w-5" />,
  },
  {
    id: "install",
    title: "install the extension",
    description:
      "add trail to your browser to start capturing. it takes less than a minute.",
    icon: <DownloadIcon className="h-5 w-5" />,
  },
  {
    id: "capture",
    title: "capture anything",
    description:
      "click the trail icon in your browser whenever you want to record a workflow. we'll handle the rest.",
    icon: <MousePointerClickIcon className="h-5 w-5" />,
  },
  {
    id: "organize",
    title: "auto-organize",
    description:
      "your trails are automatically grouped by session, timestamp, and context. no manual sorting needed.",
    icon: <TargetIcon className="h-5 w-5" />,
  },
  {
    id: "share",
    title: "share & collaborate",
    description:
      "review your trails in the dashboard and share them with your team. knowledge sharing made simple.",
    icon: <ShareIcon className="h-5 w-5" />,
  },
];

function ProgressDots({
  total,
  current,
  onDotClick,
}: {
  total: number;
  current: number;
  onDotClick?: (index: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2" role="tablist">
      {Array.from({ length: total }).map((_, index) => (
        <button
          key={index}
          onClick={() => onDotClick?.(index)}
          className={cn(
            "h-2 rounded-full transition-all duration-300",
            index === current
              ? "w-6 bg-accent"
              : index < current
                ? "w-2 bg-accent/60"
                : "w-2 bg-border hover:bg-border/80",
          )}
          aria-label={`Go to step ${index + 1}`}
          aria-current={index === current ? "step" : undefined}
          role="tab"
        />
      ))}
    </div>
  );
}

function StepIndicator({
  steps,
  currentStep,
}: {
  steps: TutorialStep[];
  currentStep: number;
}) {
  return (
    <div className="relative">
      {/* Progress bar background */}
      <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-border/60" />

      {/* Active progress */}
      <motion.div
        className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-accent"
        initial={{ width: "0%" }}
        animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        transition={{ duration: 0.3 }}
      />

      {/* Step indicators */}
      <div className="relative flex justify-between">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold transition-colors",
              index <= currentStep
                ? "border-accent bg-accent text-accent-contrast"
                : "border-border/60 bg-surface text-ink-muted",
            )}
            animate={index === currentStep ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            {index < currentStep ? (
              <CheckIcon className="h-3 w-3" />
            ) : (
              index + 1
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function WelcomeModal({
  isOpen,
  onClose,
  onSkip,
  onComplete,
  userName,
}: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [direction, setDirection] = React.useState(0);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete?.();
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    onSkip?.();
    onClose();
  };

  const handleDotClick = (index: number) => {
    setDirection(index > currentStep ? 1 : -1);
    setCurrentStep(index);
  };

  const currentTutorialStep = tutorialSteps[currentStep];
  const isLastStep = currentStep === tutorialSteps.length - 1;
  const isFirstStep = currentStep === 0;

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 50 : -50,
      opacity: 0,
    }),
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={handleSkip}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-surface/95 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
          >
            {/* Close button */}
            <button
              onClick={handleSkip}
              className="absolute right-4 top-4 rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-high hover:text-ink"
              aria-label="Close welcome modal"
            >
              <XIcon className="h-4 w-4" />
            </button>

            {/* Content */}
            <div className="p-6">
              {/* Header */}
              <div className="mb-6 text-center">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={`header-${currentStep}`}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2 }}
                  >
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                      {currentTutorialStep.icon}
                    </div>
                    <h2
                      id="welcome-title"
                      className="text-2xl font-semibold text-ink"
                    >
                      {isFirstStep && userName
                        ? `hi ${userName}, ${currentTutorialStep.title}`
                        : currentTutorialStep.title}
                    </h2>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Description */}
              <div className="mb-8 min-h-[80px]">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.p
                    key={`desc-${currentStep}`}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2, delay: 0.05 }}
                    className="text-center text-sm text-ink-muted leading-relaxed"
                  >
                    {currentTutorialStep.description}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Progress */}
              <div className="mb-8">
                <ProgressDots
                  total={tutorialSteps.length}
                  current={currentStep}
                  onDotClick={handleDotClick}
                />
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  disabled={isFirstStep}
                  className={cn("text-ink-muted", isFirstStep && "invisible")}
                >
                  back
                </Button>

                <div className="flex items-center gap-3">
                  {!isLastStep && (
                    <Button variant="ghost" size="sm" onClick={handleSkip}>
                      skip
                    </Button>
                  )}
                  <Button size="sm" onClick={handleNext}>
                    {isLastStep ? (
                      "get started"
                    ) : (
                      <>
                        next
                        <ArrowRightIcon className="ml-1 h-3 w-3" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Bottom gradient decoration */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-accent/5 to-transparent" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Hook to manage welcome modal state
export function useWelcomeModal(storageKey = "trail-welcome-shown") {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hasBeenShown, setHasBeenShown] = React.useState(true);

  React.useEffect(() => {
    // Check if welcome has been shown before
    const shown =
      typeof window !== "undefined"
        ? localStorage.getItem(storageKey) === "true"
        : false;
    setHasBeenShown(shown);
    if (!shown) {
      setIsOpen(true);
    }
  }, [storageKey]);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  const markAsShown = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, "true");
    }
    setHasBeenShown(true);
  };

  const reset = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
    setHasBeenShown(false);
  };

  return {
    isOpen,
    hasBeenShown,
    open,
    close,
    markAsShown,
    reset,
  };
}
