"use client";

import * as React from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  Shield,
  Zap,
  Users,
} from "@trail/ui/icons";
import { Button, cn } from "@trail/ui";

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
};

const STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "welcome to trail",
    description: "your personal browsing history, organized and searchable.",
    icon: <Sparkles className="h-6 w-6" />,
    features: [
      "capture every path you take online",
      "search through your history instantly",
      "export and share your trails",
    ],
  },
  {
    id: "extension",
    title: "install the extension",
    description: "trail lives in your browser. install it to start capturing.",
    icon: <Zap className="h-6 w-6" />,
    features: [
      "one-click install from chrome store",
      "runs silently in the background",
      "privacy-first: data stays yours",
    ],
  },
  {
    id: "account",
    title: "secure your account",
    description: "connect your account to sync across devices.",
    icon: <Shield className="h-6 w-6" />,
    features: [
      "sync trails across all devices",
      "end-to-end encryption",
      "easy backup and export",
    ],
  },
  {
    id: "team",
    title: "collaborate with team",
    description: "share trails and work together with your team.",
    icon: <Users className="h-6 w-6" />,
    features: [
      "shared workspaces",
      "real-time collaboration",
      "team analytics and insights",
    ],
  },
];

export function OnboardingModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const isMarkingSeenRef = React.useRef(false);

  React.useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const response = await fetch("/api/onboarding", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { seen?: boolean };
        if (!payload.seen) {
          setIsOpen(true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboarding();
  }, []);

  const markOnboardingSeen = React.useCallback(async () => {
    if (isMarkingSeenRef.current) {
      return;
    }

    isMarkingSeenRef.current = true;

    try {
      await fetch("/api/onboarding", {
        method: "POST",
        cache: "no-store",
      });
    } finally {
      isMarkingSeenRef.current = false;
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    void markOnboardingSeen();
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  if (isLoading || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-lg">
      <div className="relative w-full max-w-lg rounded-[28px] border border-border/60 bg-surface p-8 shadow-2xl">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-2 text-ink-muted transition hover:bg-surface-high hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress bar */}
        <div className="absolute left-8 right-8 top-0 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-surface-high">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="mt-4">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent">
            {step.icon}
          </div>

          {/* Title */}
          <h2 className="text-center text-xl font-semibold lowercase text-ink">
            {step.title}
          </h2>

          {/* Description */}
          <p className="mt-2 text-center text-sm text-ink-muted">
            {step.description}
          </p>

          {/* Features */}
          <ul className="mt-6 space-y-3">
            {step.features.map((feature, idx) => (
              <li
                key={idx}
                className="flex items-center gap-3 text-sm text-ink-muted"
              >
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-accent" />
                <span className="lowercase">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          {/* Back button */}
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border transition",
              currentStep === 0
                ? "border-border/30 text-ink-muted/30 cursor-not-allowed"
                : "border-border/60 text-ink hover:border-accent/60 hover:text-accent",
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  idx === currentStep
                    ? "w-6 bg-accent"
                    : "w-2 bg-border/60 hover:bg-border",
                )}
              />
            ))}
          </div>

          {/* Next button */}
          <Button onClick={handleNext} size="sm" className="px-6 lowercase">
            {isLastStep ? "finish" : "next"}
          </Button>
        </div>

        {/* Skip link */}
        <button
          onClick={handleSkip}
          className="mt-4 block w-full text-center text-xs text-ink-muted transition hover:text-ink lowercase"
        >
          skip tour
        </button>
      </div>
    </div>
  );
}
