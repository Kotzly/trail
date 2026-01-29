import * as React from "react";
import { cn } from "../utils/cn";

export type SectionHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cn("flex flex-wrap items-start justify-between gap-4", className)}
      {...props}
    >
      <div className="space-y-2">
        {eyebrow ? <p className="trail-eyebrow">{eyebrow}</p> : null}
        <h2 className="text-xl font-semibold text-ink md:text-2xl">{title}</h2>
        {subtitle ? <p className="trail-copy text-sm">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
