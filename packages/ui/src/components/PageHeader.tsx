import * as React from "react";
import { cn } from "../utils/cn";

export type PageHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
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
        <h1 className="text-2xl font-semibold lowercase text-ink md:text-3xl">
          {title}
        </h1>
        {subtitle ? <p className="trail-copy text-sm">{subtitle}</p> : null}
        {children ? <div className="pt-2">{children}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
