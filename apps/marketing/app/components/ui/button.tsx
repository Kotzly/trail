import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@trail/ui";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium ring-offset-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-cta text-cta-fg hover:bg-cta-hover",
        destructive: "bg-red-500 text-white hover:bg-red-500/90",
        outline:
          "border border-border bg-surface text-ink hover:bg-surface-high",
        secondary: "bg-surface-high text-ink hover:bg-surface",
        ghost: "text-ink hover:bg-surface-high",
        link: "text-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-full px-3",
        lg: "h-11 rounded-full px-8",
        icon: "h-10 w-10",
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

const Button = Object.assign(ButtonRoot, {
  AsChild: ButtonAsChild,
}) as ButtonComponent;
Button.displayName = "Button";
Button.AsChild.displayName = "Button.AsChild";

export { Button, buttonVariants };
