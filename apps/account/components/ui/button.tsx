"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-cta text-cta-fg hover:bg-cta-hover",
        outline:
          "border border-border bg-transparent text-ink hover:bg-surface-high",
        ghost: "bg-transparent text-ink hover:bg-surface-high",
        subtle: "bg-surface text-ink hover:bg-surface-high",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

type ButtonComponent = React.ForwardRefExoticComponent<
  ButtonProps & React.RefAttributes<HTMLButtonElement>
> & {
  AsChild: React.ForwardRefExoticComponent<
    ButtonProps & React.RefAttributes<HTMLElement>
  >;
};

const getButtonClasses = ({ className, variant, size }: ButtonProps) =>
  cn(buttonVariants({ variant, size, className }));

const ButtonRoot = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={getButtonClasses({ className, variant, size })}
      {...props}
    />
  ),
);
ButtonRoot.displayName = "ButtonRoot";

const ButtonAsChild = React.forwardRef<HTMLElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <Slot
      ref={ref}
      className={getButtonClasses({ className, variant, size })}
      {...props}
    />
  ),
);
ButtonAsChild.displayName = "ButtonAsChild";

export const Button = Object.assign(ButtonRoot, {
  AsChild: ButtonAsChild,
}) as ButtonComponent;
Button.displayName = "Button";
Button.AsChild.displayName = "Button.AsChild";

export { buttonVariants };
