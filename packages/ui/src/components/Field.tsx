import * as React from "react";
import { cn } from "../utils/cn";

export type FieldProps = React.HTMLAttributes<HTMLDivElement>;

export function Field({ className, ...props }: FieldProps) {
  return <div className={cn("grid gap-2", className)} {...props} />;
}
