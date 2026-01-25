import * as React from "react";
import { cn } from "../utils/cn";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border/70 bg-surface/80 p-6 shadow-elev-1 backdrop-blur",
        className
      )}
      {...props}
    />
  );
}
