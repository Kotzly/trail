import { cn } from "@ui/lib/utils";

type StepDotsProps = {
  total: number;
  current: number;
  className?: string;
};

export function StepDots({ total, current, className }: StepDotsProps) {
  return (
    <div
      className={cn("flex items-center justify-center gap-1.5", className)}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      aria-label={`Step ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const state = i < current ? "past" : i === current ? "current" : "future";
        // Fixed track width (5px = "current" target). Past/future dots
        // scale down to 30% on the X axis. Animating transform avoids
        // layout invalidation per frame — only compositor work runs.
        return (
          <span
            key={i}
            className={cn(
              "block h-1.5 w-5 origin-center rounded-full transition-[transform,background-color,opacity] duration-300 ease-out",
              state === "current" && "bg-primary scale-x-100",
              state === "past" && "bg-primary/60 scale-x-[0.3]",
              state === "future" && "bg-border scale-x-[0.3] opacity-60",
            )}
          />
        );
      })}
    </div>
  );
}
