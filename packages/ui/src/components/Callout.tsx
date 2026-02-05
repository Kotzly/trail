import * as React from "react";
import { cn } from "../utils/cn";

export type CalloutProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string;
  tone?: "neutral" | "warning" | "success";
};

const toneClasses: Record<NonNullable<CalloutProps["tone"]>, string> = {
  neutral: "border-border/60 bg-surface/85",
  warning: "border-amber-500/30 bg-amber-50/60",
  success: "border-emerald-500/30 bg-emerald-50/60",
};

export function Callout({
  title,
  tone = "neutral",
  className,
  children,
  ...props
}: CalloutProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 text-sm text-ink",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children ? <div className="mt-1 text-xs text-ink-muted">{children}</div> : null}
    </div>
  );
}
