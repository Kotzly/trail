import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../utils/cn";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[1rem]"
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-accent text-accent-contrast hover:bg-ink-muted focus-visible:ring-2 focus-visible:ring-ink",
  outline:
    "border border-border bg-transparent text-ink hover:bg-surface-high focus-visible:ring-2 focus-visible:ring-ink",
  ghost:
    "bg-transparent text-ink hover:bg-surface-high focus-visible:ring-2 focus-visible:ring-ink"
};

export function Button({
  className,
  asChild,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:pointer-events-none disabled:opacity-60",
        "focus-visible:outline-none",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
