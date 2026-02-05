import * as React from "react";
import { cn } from "../utils/cn";

export type TextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[120px] w-full rounded-2xl border border-border/60 bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/30",
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";
