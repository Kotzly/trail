import * as React from "react";
import { cn } from "../utils/cn";

export type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  items?: readonly string[];
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  items,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/60 bg-surface/85 p-6 shadow-card",
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-6 top-6 h-24 w-24 rounded-full bg-ink/5 blur-2xl" />
        <div className="absolute -left-8 bottom-4 h-28 w-28 rounded-full bg-ink/5 blur-2xl" />
      </div>
      <div className="relative space-y-4">
        {icon ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-surface shadow-card">
            {icon}
          </div>
        ) : null}
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-ink md:text-2xl">{title}</h3>
          {description ? <p className="trail-copy text-sm">{description}</p> : null}
        </div>
        {items && items.length > 0 ? (
          <ul className="grid gap-2 text-sm text-ink-muted">
            {items.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-ink" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {action || secondaryAction ? (
          <div className="flex flex-wrap items-center gap-3">
            {action}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    </div>
  );
}
