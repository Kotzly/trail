import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../utils/cn";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};

type ButtonComponent = React.ForwardRefExoticComponent<
  ButtonProps & React.RefAttributes<HTMLButtonElement>
> & {
  AsChild: React.ForwardRefExoticComponent<
    ButtonProps & React.RefAttributes<HTMLElement>
  >;
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

function getButtonClasses({
  className,
  variant = "primary",
  size = "md"
}: ButtonProps) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:pointer-events-none disabled:opacity-60",
    "focus-visible:outline-none",
    sizeClasses[size],
    variantClasses[variant],
    className
  );
}

const ButtonRoot = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={getButtonClasses({ className, variant, size })}
      {...props}
    />
  )
);

const ButtonAsChild = React.forwardRef<HTMLElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <Slot
      ref={ref}
      className={getButtonClasses({ className, variant, size })}
      {...props}
    />
  )
);

export const Button = Object.assign(ButtonRoot, {
  AsChild: ButtonAsChild
}) as ButtonComponent;

Button.displayName = "Button";
Button.AsChild.displayName = "Button.AsChild";
