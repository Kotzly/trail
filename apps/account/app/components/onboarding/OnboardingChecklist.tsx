"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  MousePointerClickIcon,
  ShareIcon,
  SparklesIcon,
  UserIcon,
} from "@trail/ui/icons";
import { cn } from "@trail/ui";
import { accountCopy } from "@trail/content";

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  tooltip: string;
  icon: React.ReactNode;
  completed: boolean;
  href?: string;
  estimatedMinutes?: number;
};

export type OnboardingChecklistProps = {
  steps: OnboardingStep[];
  className?: string;
  onStepClick?: (step: OnboardingStep) => void;
  onToggleExpand?: (expanded: boolean) => void;
  initiallyExpanded?: boolean;
};

function ProgressIndicator({
  steps,
  className,
}: {
  steps: OnboardingStep[];
  className?: string;
}) {
  const completedCount = steps.filter((s) => s.completed).length;
  const progress = (completedCount / steps.length) * 100;
  const remainingSteps = steps.filter((s) => !s.completed).length;
  const estimatedMinutes = steps
    .filter((s) => !s.completed)
    .reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="trail-pill">
            {completedCount}/{steps.length}
          </span>
          <span className="text-xs text-ink-muted">
            {remainingSteps === 0
              ? "all done!"
              : `${remainingSteps} step${remainingSteps !== 1 ? "s" : ""} left`}
          </span>
        </div>
        {estimatedMinutes > 0 && remainingSteps > 0 && (
          <span className="text-xs text-ink-subtle">
            ~{estimatedMinutes} min{estimatedMinutes !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-surface-high">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function StepItem({
  step,
  index,
  onClick,
}: {
  step: OnboardingStep;
  index: number;
  onClick?: () => void;
}) {
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border p-3 transition-colors",
        step.completed
          ? "border-border/40 bg-surface/50"
          : "border-border/60 bg-surface cursor-pointer hover:border-accent/50 hover:bg-surface-high",
      )}
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={step.completed ? -1 : 0}
      role="button"
      aria-label={`${step.title}${step.completed ? " - completed" : ""}`}
    >
      {/* Step number / checkmark */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-all",
          step.completed
            ? "border-ink bg-ink text-surface"
            : "border-accent/60 bg-accent/10 text-accent animate-pulse",
        )}
      >
        <AnimatePresence mode="wait">
          {step.completed ? (
            <motion.div
              key="check"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <CheckIcon className="h-4 w-4" />
            </motion.div>
          ) : (
            <motion.span
              key="number"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              {index + 1}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              step.completed ? "text-ink-muted line-through" : "text-ink",
            )}
          >
            {step.title}
          </span>
          {!step.completed && step.estimatedMinutes && (
            <span className="text-[0.65rem] text-ink-subtle">
              ~{step.estimatedMinutes}m
            </span>
          )}
        </div>
        <p
          className={cn(
            "text-xs mt-0.5",
            step.completed ? "text-ink-subtle" : "text-ink-muted",
          )}
        >
          {step.description}
        </p>
      </div>

      {/* Icon */}
      <div
        className={cn(
          "shrink-0 text-ink-subtle",
          step.completed && "opacity-50",
        )}
      >
        {step.icon}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && !step.completed && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 bottom-full mb-2 z-50"
          >
            <div className="rounded-lg border border-border/60 bg-surface/95 backdrop-blur-sm px-3 py-2 shadow-lg">
              <p className="text-xs text-ink">{step.tooltip}</p>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-surface/95 border-r border-b border-border/60 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Celebration({ onComplete }: { onComplete?: () => void }) {
  React.useEffect(() => {
    const timer = setTimeout(() => onComplete?.(), 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex flex-col items-center justify-center py-6 text-center"
    >
      <motion.div
        animate={{
          rotate: [0, -10, 10, -10, 10, 0],
          scale: [1, 1.2, 1, 1.2, 1],
        }}
        transition={{ duration: 0.5, repeat: 2 }}
        className="mb-3"
      >
        <SparklesIcon className="h-10 w-10 text-accent" />
      </motion.div>
      <h4 className="text-sm font-semibold text-ink">you&apos;re all set!</h4>
      <p className="text-xs text-ink-muted mt-1">
        ready to capture your first trail
      </p>
    </motion.div>
  );
}

export function OnboardingChecklist({
  steps: initialSteps,
  className,
  onStepClick,
  onToggleExpand,
  initiallyExpanded = false,
}: OnboardingChecklistProps) {
  const [isExpanded, setIsExpanded] = React.useState(initiallyExpanded);
  const [showCelebration, setShowCelebration] = React.useState(false);
  const [steps, setSteps] = React.useState(initialSteps);

  const allCompleted = steps.every((s) => s.completed);
  const completedCount = steps.filter((s) => s.completed).length;

  React.useEffect(() => {
    if (allCompleted && completedCount > 0) {
      setShowCelebration(true);
    }
  }, [allCompleted, completedCount]);

  React.useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggleExpand?.(newExpanded);
  };

  const handleStepClick = (step: OnboardingStep, index: number) => {
    if (step.completed) return;
    onStepClick?.(step);
  };

  if (showCelebration) {
    return (
      <div className={cn("trail-card-soft overflow-hidden", className)}>
        <Celebration onComplete={() => setShowCelebration(false)} />
      </div>
    );
  }

  return (
    <div className={cn("trail-card-soft overflow-hidden", className)}>
      {/* Header */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-surface-high/50 transition-colors"
        aria-expanded={isExpanded}
        aria-controls="onboarding-steps"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-surface">
            <UserIcon className="h-4 w-4 text-ink" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {accountCopy.dashboard.onboarding.title}
            </h3>
            <p className="text-xs text-ink-muted">
              {accountCopy.dashboard.onboarding.subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="trail-pill">
            {completedCount}/{steps.length}
          </span>
          {isExpanded ? (
            <ChevronUpIcon className="h-4 w-4 text-ink-muted" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 text-ink-muted" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            id="onboarding-steps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              <ProgressIndicator steps={steps} />
              <div className="space-y-2 pt-2">
                {steps.map((step, index) => (
                  <StepItem
                    key={step.id}
                    step={step}
                    index={index}
                    onClick={() => handleStepClick(step, index)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function useOnboardingSteps(
  userProgress: Partial<Record<string, boolean>> = {},
): OnboardingStep[] {
  return React.useMemo(
    () => [
      {
        id: "install-extension",
        title: "install extension",
        description: "add trail to your browser",
        tooltip: "click to open the chrome web store and install the extension",
        icon: <DownloadIcon className="h-4 w-4" />,
        completed: userProgress["install-extension"] || false,
        href: "/extension",
        estimatedMinutes: 2,
      },
      {
        id: "connect-account",
        title: "connect account",
        description: "link your browser to trail",
        tooltip: "open the extension and sign in with your account",
        icon: <UserIcon className="h-4 w-4" />,
        completed: userProgress["connect-account"] || false,
        href: "/extension",
        estimatedMinutes: 1,
      },
      {
        id: "capture-trail",
        title: "capture your first trail",
        description: "record a workflow",
        tooltip: "click the trail icon and start recording your first session",
        icon: <MousePointerClickIcon className="h-4 w-4" />,
        completed: userProgress["capture-trail"] || false,
        href: "/dashboard",
        estimatedMinutes: 3,
      },
      {
        id: "share-trail",
        title: "share or review",
        description: "explore your captures",
        tooltip: "view your trails in the dashboard and share with your team",
        icon: <ShareIcon className="h-4 w-4" />,
        completed: userProgress["share-trail"] || false,
        href: "/dashboard",
        estimatedMinutes: 2,
      },
    ],
    [userProgress],
  );
}
