import * as React from "react";
import { cn } from "../utils/cn";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      data-testid="skeleton"
      className={cn("animate-pulse rounded-md bg-surface-high", className)}
      {...props}
    />
  );
}
