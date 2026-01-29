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
        "flex flex-col gap-2 rounded-xl border border-border/40 bg-transparent px-4 py-3",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium lowercase text-ink-muted">{label}</p>
        {icon ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface/60 text-ink">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="text-xl font-semibold text-ink">{value}</p>
        {badge ? <div className="text-xs text-ink-muted">{badge}</div> : null}
      </div>
      {caption ? <p className="text-xs text-ink-muted">{caption}</p> : null}
    </div>
  );
}
