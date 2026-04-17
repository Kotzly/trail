import { cn } from "@ui/lib/utils";
import { Spinner } from "@ui/components/ui/spinner";

type StartCardProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  onSelect: () => void;
  loading?: boolean;
  disabled?: boolean;
  emphasis?: "primary" | "subtle";
};

export function StartCard({
  title,
  description,
  icon,
  onSelect,
  loading = false,
  disabled = false,
  emphasis = "subtle",
}: StartCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled || loading}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-lg border p-3 text-left",
        "transition-[transform,background-color,border-color] duration-150 ease-out",
        "hover:-translate-y-[0.5px] active:translate-y-0 active:scale-[0.985]",
        "focus-visible:ring-ring/70 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
        emphasis === "primary"
          ? "border-primary/40 bg-primary/[0.04] hover:border-primary/60 hover:bg-primary/[0.07]"
          : "border-border bg-card hover:border-foreground/25 hover:bg-accent/40",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md border",
          emphasis === "primary"
            ? "border-primary/30 bg-primary/10 text-primary"
            : "border-border bg-muted/60 text-muted-foreground",
        )}
        aria-hidden
      >
        {loading ? <Spinner className="size-4" /> : icon}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-foreground text-sm leading-tight font-medium">{title}</span>
        <span className="text-muted-foreground text-xs leading-snug">{description}</span>
      </div>
    </button>
  );
}
