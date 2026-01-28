import { TrailLogo } from "./TrailLogo";
import { cn } from "../utils/cn";

export type TrailLoaderProps = {
  className?: string;
  label?: string;
};

export function TrailLoader({ className, label }: TrailLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <TrailLogo animated className="trail-logo--md" />
      {label ? (
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-muted">
          {label}
        </span>
      ) : null}
    </div>
  );
}
