import { cn } from "@ui/lib/utils";
import { Button } from "@ui/components/ui/button";
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
    <Button
      type="button"
      variant={emphasis === "primary" ? "default" : "outline"}
      onClick={onSelect}
      disabled={disabled || loading}
      className={cn(
        "group relative h-auto w-full items-center justify-start gap-3 p-3 text-left text-sm whitespace-normal",
        "transition-[transform,background-color] duration-150 ease-out",
        "hover:-translate-y-[0.5px] active:translate-y-0 active:scale-[0.985]",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center border",
          emphasis === "primary"
            ? "border-primary-foreground/30 bg-primary-foreground/10"
            : "border-border bg-muted/60 text-muted-foreground",
        )}
        aria-hidden
      >
        {loading ? <Spinner className="size-4" /> : icon}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm leading-tight font-medium">{title}</span>
        <span
          className={cn(
            "text-xs leading-snug",
            emphasis === "primary" ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {description}
        </span>
      </div>
    </Button>
  );
}
