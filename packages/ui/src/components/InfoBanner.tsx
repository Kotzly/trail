import * as React from "react";
import { cn } from "../utils/cn";

export type InfoBannerProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "neutral" | "emphasis" | "warning";
};

const toneStyles: Record<NonNullable<InfoBannerProps["tone"]>, string> = {
  neutral: "border-border/60 bg-surface/85",
  emphasis: "border-ink/20 bg-surface-high/80",
  warning: "border-amber-500/30 bg-amber-50/60"
};

export function InfoBanner({
  title,
  description,
  icon,
  action,
  tone = "neutral",
  className,
  ...props
}: InfoBannerProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 shadow-card",
        toneStyles[tone],
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-surface">
            {icon}
          </div>
        ) : null}
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          {description ? <p className="text-xs text-ink-muted">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
