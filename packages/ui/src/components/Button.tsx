import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../utils/cn";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "subtle";
  size?: "sm" | "md" | "lg" | "icon";
};

type ButtonComponent = React.ForwardRefExoticComponent<
  ButtonProps & React.RefAttributes<HTMLButtonElement>
> & {
  AsChild: React.ForwardRefExoticComponent<
    ButtonProps & React.RefAttributes<HTMLElement>
  >;
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-9 w-9"
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-cta text-cta-fg hover:bg-cta-hover",
  outline:
    "border border-border bg-transparent text-ink hover:bg-surface-high",
  ghost:
    "bg-transparent text-ink hover:bg-surface-high",
  subtle: "bg-surface text-ink hover:bg-surface-high"
};

function getButtonClasses({
  className,
  variant = "primary",
  size = "md"
}: ButtonProps) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "disabled:pointer-events-none disabled:opacity-50",
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
