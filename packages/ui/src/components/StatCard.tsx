import * as React from "react";
import { cn } from "../utils/cn";

export type StatCardProps = React.HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string;
  caption?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
};

export function StatCard({
  label,
  value,
  caption,
  icon,
  badge,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface/85 p-4 shadow-card",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        {icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-surface">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold text-ink">{value}</p>
        {badge ? <div className="text-xs text-ink-muted">{badge}</div> : null}
      </div>
      {caption ? <p className="text-xs text-ink-muted">{caption}</p> : null}
    </div>
  );
}
