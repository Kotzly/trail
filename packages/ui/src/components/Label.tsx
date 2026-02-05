import * as React from "react";
import { cn } from "../utils/cn";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn("text-xs font-medium text-ink", className)}
      {...props}
    />
  );
}
