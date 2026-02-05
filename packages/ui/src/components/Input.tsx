import * as React from "react";
import { cn } from "../utils/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn("trail-input", className)}
      {...props}
    />
  )
);

Input.displayName = "Input";
