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
        return (
          <span
            key={i}
            className={cn(
              "block h-1.5 rounded-full transition-[width,background-color,opacity] duration-300 ease-out",
              state === "current" && "bg-primary w-5",
              state === "past" && "bg-primary/60 w-1.5",
              state === "future" && "bg-border w-1.5 opacity-60",
            )}
          />
        );
      })}
    </div>
  );
}
