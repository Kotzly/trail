import * as React from "react";
import { cn } from "../utils/cn";

export type PageHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  meta,
  className,
  children,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border/60 pb-4 md:flex-row md:items-end md:justify-between",
        className
      )}
      {...props}
    >
      <div className="space-y-2">
        {eyebrow ? <p className="trail-eyebrow">{eyebrow}</p> : null}
        <h1 className="trail-title">{title}</h1>
        {subtitle ? <p className="trail-copy max-w-2xl">{subtitle}</p> : null}
        {meta ? (
          <div
            data-testid="page-header-meta"
            className="flex flex-wrap items-center gap-2 text-xs text-ink-muted"
          >
            {meta}
          </div>
        ) : null}
        {children ? <div className="pt-2">{children}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
