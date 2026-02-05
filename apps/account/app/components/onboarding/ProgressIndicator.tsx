"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CheckIcon, ClockIcon, Loader2Icon } from "lucide-react";
import { cn } from "@trail/ui";

export type StepStatus = "pending" | "current" | "completed" | "error";

export type ProgressStep = {
  id: string;
  label: string;
  description?: string;
  status: StepStatus;
  estimatedMinutes?: number;
};

export type ProgressIndicatorProps = {
  steps: ProgressStep[];
  className?: string;
  orientation?: "horizontal" | "vertical";
  showTimeEstimate?: boolean;
  onStepClick?: (step: ProgressStep, index: number) => void;
};

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          <CheckIcon className="h-4 w-4" />
        </motion.div>
      );
    case "current":
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2Icon className="h-4 w-4" />
        </motion.div>
      );
    case "error":
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="text-destructive"
        >
          <span className="text-sm font-bold">!</span>
        </motion.div>
      );
    default:
      return null;
  }
}

function HorizontalStep({
  step,
  index,
  total,
  onClick,
}: {
  step: ProgressStep;
  index: number;
  total: number;
  onClick?: () => void;
}) {
  const isClickable = step.status !== "pending" && onClick;

  return (
    <div className="relative flex flex-1 flex-col items-center">
      {/* Connector line */}
      {index < total - 1 && (
        <div
          className={cn(
            "absolute left-1/2 top-4 h-0.5 w-full -translate-y-1/2",
            step.status === "completed" ? "bg-accent" : "bg-border/60"
          )}
        />
      )}

      {/* Step circle */}
      <motion.button
        onClick={isClickable ? onClick : undefined}
        className={cn(
          "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
          step.status === "completed" &&
            "border-accent bg-accent text-accent-contrast",
          step.status === "current" &&
            "border-accent bg-accent/20 text-accent ring-2 ring-accent/30 ring-offset-2 ring-offset-surface animate-pulse",
          step.status === "error" &&
            "border-destructive bg-destructive/20 text-destructive",
          step.status === "pending" &&
            "border-border/60 bg-surface text-ink-muted",
          isClickable && "cursor-pointer hover:scale-110"
        )}
        whileHover={isClickable ? { scale: 1.1 } : {}}
        whileTap={isClickable ? { scale: 0.95 } : {}}
        aria-label={`${step.label} - ${step.status}`}
        aria-current={step.status === "current" ? "step" : undefined}
      >
        {step.status === "pending" ? index + 1 : <StepIcon status={step.status} />}
      </motion.button>

      {/* Label */}
      <div className="mt-2 text-center">
        <p
          className={cn(
            "text-xs font-medium",
            step.status === "current" ? "text-ink" : "text-ink-muted"
          )}
        >
          {step.label}
        </p>
        {step.description && (
          <p className="text-[0.65rem] text-ink-subtle mt-0.5 max-w-[80px] leading-tight">
            {step.description}
          </p>
        )}
      </div>
    </div>
  );
}

function VerticalStep({
  step,
  index,
  total,
  onClick,
}: {
  step: ProgressStep;
  index: number;
  total: number;
  onClick?: () => void;
}) {
  const isClickable = step.status !== "pending" && onClick;

  return (
    <div className="relative flex gap-4">
      {/* Connector line */}
      {index < total - 1 && (
        <div
          className={cn(
            "absolute left-4 top-8 w-0.5",
            step.status === "completed" ? "bg-accent" : "bg-border/60"
          )}
          style={{ height: "calc(100% + 1rem)" }}
        />
      )}

      {/* Step circle */}
      <motion.button
        onClick={isClickable ? onClick : undefined}
        className={cn(
          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
          step.status === "completed" &&
            "border-accent bg-accent text-accent-contrast",
          step.status === "current" &&
            "border-accent bg-accent/20 text-accent ring-2 ring-accent/30 ring-offset-2 ring-offset-surface animate-pulse",
          step.status === "error" &&
            "border-destructive bg-destructive/20 text-destructive",
          step.status === "pending" &&
            "border-border/60 bg-surface text-ink-muted",
          isClickable && "cursor-pointer hover:scale-110"
        )}
        whileHover={isClickable ? { scale: 1.1 } : {}}
        whileTap={isClickable ? { scale: 0.95 } : {}}
        aria-label={`${step.label} - ${step.status}`}
        aria-current={step.status === "current" ? "step" : undefined}
      >
        {step.status === "pending" ? index + 1 : <StepIcon status={step.status} />}
      </motion.button>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-sm font-medium",
              step.status === "completed" && "text-accent",
              step.status === "current" && "text-ink",
              step.status === "pending" && "text-ink-muted"
            )}
          >
            {step.label}
          </p>
          {step.estimatedMinutes && step.status !== "completed" && (
            <span className="flex items-center gap-1 text-[0.65rem] text-ink-subtle">
              <ClockIcon className="h-3 w-3" />
              ~{step.estimatedMinutes}m
            </span>
          )}
        </div>
        {step.description && (
          <p
            className={cn(
              "text-xs mt-1",
              step.status === "pending" ? "text-ink-subtle" : "text-ink-muted"
            )}
          >
            {step.description}
          </p>
        )}
      </div>
    </div>
  );
}

export function ProgressIndicator({
  steps,
  className,
  orientation = "horizontal",
  showTimeEstimate = true,
  onStepClick,
}: ProgressIndicatorProps) {
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const currentStepIndex = steps.findIndex((s) => s.status === "current");
  const progress = (completedCount / steps.length) * 100;
  
  const remainingMinutes = showTimeEstimate
    ? steps
        .filter((s) => s.status !== "completed")
        .reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0)
    : 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with progress */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-muted">
          {completedCount} of {steps.length} completed
        </span>
        {showTimeEstimate && remainingMinutes > 0 && (
          <span className="flex items-center gap-1 text-ink-subtle">
            <ClockIcon className="h-3 w-3" />
            ~{remainingMinutes} min remaining
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-high">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Steps */}
      {orientation === "horizontal" ? (
        <div className="flex">
          {steps.map((step, index) => (
            <HorizontalStep
              key={step.id}
              step={step}
              index={index}
              total={steps.length}
              onClick={() => onStepClick?.(step, index)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-0">
          {steps.map((step, index) => (
            <VerticalStep
              key={step.id}
              step={step}
              index={index}
              total={steps.length}
              onClick={() => onStepClick?.(step, index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
