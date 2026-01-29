import * as React from "react";
import { cn } from "../utils/cn";

export type StepItem = {
  title: string;
  description?: string;
  status?: "done" | "current" | "upcoming";
};

export type StepListProps = React.HTMLAttributes<HTMLDivElement> & {
  steps: readonly StepItem[];
};

export function StepList({ steps, className, ...props }: StepListProps) {
  return (
    <div className={cn("grid gap-3", className)} {...props}>
      {steps.map((step, index) => {
        const status = step.status ?? "upcoming";
        const tone =
          status === "done"
            ? "border-ink bg-ink text-surface"
            : status === "current"
              ? "border-ink/40 bg-surface text-ink"
              : "border-border/60 bg-surface text-ink-muted";
        return (
          <div key={`${step.title}-${index}`} className="trail-step flex gap-4">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                tone
              )}
            >
              {index + 1}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{step.title}</p>
              {step.description ? (
                <p className="mt-1 text-xs text-ink-muted">{step.description}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
