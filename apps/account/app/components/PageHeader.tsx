import * as React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-4",
        className,
      )}
    >
      <div className="space-y-2">
        {eyebrow ? <p className="trail-eyebrow">{eyebrow}</p> : null}
        <h1 className="trail-title">{title}</h1>
        {subtitle ? <p className="trail-copy max-w-2xl">{subtitle}</p> : null}
        {meta ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
