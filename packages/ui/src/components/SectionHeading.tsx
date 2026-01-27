import * as React from "react";
import { cn } from "../utils/cn";

export type SectionHeadingProps = React.HTMLAttributes<HTMLDivElement> & {
  kicker?: string;
  title: string;
  subtitle?: string;
};

export function SectionHeading({
  kicker,
  title,
  subtitle,
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {kicker ? (
        <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">{kicker}</p>
      ) : null}
      <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {subtitle ? <p className="text-[1rem] text-ink-muted">{subtitle}</p> : null}
    </div>
  );
}
