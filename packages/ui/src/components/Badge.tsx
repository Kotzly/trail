import * as React from "react";
import { cn } from "../utils/cn";

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: "default" | "muted" | "accent" | "success" | "warning";
};

const toneClasses: Record<NonNullable<BadgeProps["tone"]>, string> = {
  default: "bg-surface-high text-ink",
  muted: "bg-surface-low text-ink-muted",
  accent: "bg-accent/10 text-accent",
  success: "bg-emerald-500/15 text-emerald-600",
  warning: "bg-amber-500/15 text-amber-700"
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
