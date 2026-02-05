"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { cn } from "@trail/ui";

export type StepStatus = "pending" | "current" | "completed" | "error";

export type ProgressStep = {
  id: string;
  label: string;
  description?: string;
  status: StepStatus;
};

export type ProgressIndicatorProps = {
  steps: ProgressStep[];
  className?: string;
  orientation?: "horizontal" | "vertical";
};

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return <CheckIcon className="h-3.5 w-3.5" />;
    case "current":
      return <Loader2Icon className="h-3.5 w-3.5 animate-spin" />;
    default:
      return null;
  }
}

export function ProgressIndicator({
  steps,
  className,
  orientation = "horizontal"
}: ProgressIndicatorProps) {
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progress = (completedCount / steps.length) * 100;

  if (orientation === "vertical") {
    return (
      <div className={cn("space-y-3", className)}>
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium",
                step.status === "completed" && "border-accent bg-accent text-white",
                step.status === "current" && "border-accent bg-accent/10 text-accent",
                step.status === "pending" && "border-border/60 bg-surface text-ink-muted"
              )}
            >
              {step.status === "pending" ? index + 1 : <StepIcon status={step.status} />}
            </div>
            <span
              className={cn(
                "text-sm",
                step.status === "completed" && "text-accent",
                step.status === "current" && "text-ink font-medium",
                step.status === "pending" && "text-ink-muted"
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-high">
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
