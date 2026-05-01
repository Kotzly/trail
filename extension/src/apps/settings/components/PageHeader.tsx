import type { ReactNode } from "react";
import { cn } from "@ui/lib/utils";

const EYEBROW_CLASS = "text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Optional trailing slot (e.g. a Save button, status pill). */
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "animate-in fade-in-0 slide-in-from-top-1 fill-mode-both flex items-start justify-between gap-4 pb-2 duration-(--dur-base) ease-(--ease-out)",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-foreground text-2xl font-medium tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

type SectionHeaderProps = {
  /** Editorial monospace masthead, e.g. "PROFILE". */
  eyebrow?: string;
  title?: string;
  description?: ReactNode;
  className?: string;
};

/**
 * Subsection header with optional monospace eyebrow. Title may be
 * omitted when only an eyebrow is desired (e.g. row-group labels
 * like ACTIVE / ALL TREES).
 */
export function SectionHeader({ eyebrow, title, description, className }: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "animate-in fade-in-0 slide-in-from-top-0.5 fill-mode-both flex flex-col gap-1 pb-1 duration-(--dur-fast) ease-(--ease-out)",
        className,
      )}
    >
      {eyebrow ? <span className={EYEBROW_CLASS}>{eyebrow}</span> : null}
      {title ? (
        <h2 className="text-foreground text-base font-medium tracking-tight">{title}</h2>
      ) : null}
      {description ? (
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}
