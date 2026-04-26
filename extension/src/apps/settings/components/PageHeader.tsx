import type { ReactNode } from "react";
import { cn } from "@ui/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Optional trailing slot (e.g. a Save button, status pill). */
  actions?: ReactNode;
  className?: string;
};

/**
 * Header used at the top of each settings page. Unifies typography
 * scale so every page lines up, and keeps descriptions in a muted
 * supporting role. A trailing `actions` slot lets individual pages
 * surface a status chip or primary action next to the heading
 * without each page re-inventing its own flex row.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "animate-in fade-in-0 slide-in-from-top-1 fill-mode-both flex items-start justify-between gap-4 pb-2 duration-(--dur-base) ease-(--ease-out)",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-foreground text-xl tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

type SectionHeaderProps = {
  title: string;
  description?: ReactNode;
  className?: string;
};

/**
 * Header for a subsection within a settings page (e.g. "Auto-cleanup"
 * under Behavior). Smaller than PageHeader and spaced to sit cleanly
 * above a `FieldGroup` or card list.
 */
export function SectionHeader({ title, description, className }: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "animate-in fade-in-0 slide-in-from-top-0.5 fill-mode-both flex flex-col gap-1 pb-1 duration-(--dur-fast) ease-(--ease-out)",
        className,
      )}
    >
      <h2 className="text-foreground text-sm">{title}</h2>
      {description ? (
        <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}
