import * as React from "react";
import { cn } from "../utils/cn";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-surface/70 p-6",
        className
      )}
      {...props}
    />
  );
}
