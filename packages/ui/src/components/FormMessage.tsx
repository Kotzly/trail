import * as React from "react";
import { cn } from "../utils/cn";

export type FormMessageProps = React.HTMLAttributes<HTMLParagraphElement>;

export function FormMessage({ className, ...props }: FormMessageProps) {
  return (
    <p
      className={cn("text-xs text-ink-muted", className)}
      role="alert"
      {...props}
    />
  );
}
