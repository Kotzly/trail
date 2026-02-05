"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@trail/ui";

type SectionSpacing = "hero" | "default" | "compact" | "spacious";
type ContainerSize = "sm" | "md" | "lg" | "xl";

const SECTION_SPACING_CLASS: Record<SectionSpacing, string> = {
  hero: "px-6 pt-20 pb-8",
  default: "px-6 py-12",
  compact: "px-6 py-8",
  spacious: "px-6 py-16",
};

const CONTAINER_SIZE_CLASS: Record<ContainerSize, string> = {
  sm: "max-w-3xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
};

export function MarketingPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base text-ink">
      <main className="relative overflow-hidden">{children}</main>
    </div>
  );
}

export function PageSection({
  children,
  spacing = "default",
  className,
}: {
  children: ReactNode;
  spacing?: SectionSpacing;
  className?: string;
}) {
  return (
    <section className={cn("relative", SECTION_SPACING_CLASS[spacing], className)}>
      {children}
    </section>
  );
}

export function SectionContainer({
  children,
  size = "lg",
  className,
}: {
  children: ReactNode;
  size?: ContainerSize;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto", CONTAINER_SIZE_CLASS[size], className)}>
      {children}
    </div>
  );
}

export function SurfaceCard({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-stroke/40 bg-surface/50",
        interactive
          ? "transition-all hover:border-accent/30 hover:bg-surface/70 hover:shadow-lg"
          : null,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function IconChip({
  children,
  accent = false,
  className,
}: {
  children: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-2xl",
        accent ? "bg-accent/10 text-accent" : "bg-surface-strong text-ink-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function HeroBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-accent",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function HeroTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        "mt-6 font-display text-4xl font-semibold leading-[1.15] tracking-tight text-ink md:text-5xl lg:text-6xl",
        className,
      )}
    >
      {children}
    </h1>
  );
}

export function HeroSubtitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("mx-auto mt-4 max-w-2xl text-lg text-ink-muted", className)}>
      {children}
    </p>
  );
}

export function LabelledInput({
  label,
  className,
  ...props
}: {
  label: string;
} & ComponentPropsWithoutRef<"input">) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-ink">{label}</label>
      <input
        {...props}
        className={cn(
          "h-12 w-full rounded-xl border border-stroke/60 bg-surface px-4 text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40",
          className,
        )}
      />
    </div>
  );
}

export function LabelledSelect({
  label,
  className,
  children,
  ...props
}: {
  label: string;
  children: ReactNode;
} & ComponentPropsWithoutRef<"select">) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-ink">{label}</label>
      <select
        {...props}
        className={cn(
          "h-12 w-full rounded-xl border border-stroke/60 bg-surface px-4 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40",
          className,
        )}
      >
        {children}
      </select>
    </div>
  );
}

export function LabelledTextarea({
  label,
  className,
  ...props
}: {
  label: string;
} & ComponentPropsWithoutRef<"textarea">) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-ink">{label}</label>
      <textarea
        {...props}
        className={cn(
          "w-full rounded-xl border border-stroke/60 bg-surface px-4 py-3 text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40",
          className,
        )}
      />
    </div>
  );
}
