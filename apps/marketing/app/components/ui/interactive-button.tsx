"use client";

import * as React from "react";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { cn } from "@trail/ui";

interface InteractiveButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string;
  href?: string;
  variant?: "primary" | "secondary";
}

const InteractiveButton = React.forwardRef<
  HTMLButtonElement,
  InteractiveButtonProps
>(({ text = "Button", href, variant = "primary", className, ...props }, ref) => {
  const buttonContent = (
    <>
      <span className="inline-block translate-x-0 transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0">
        {text}
      </span>
      <div className="absolute top-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 text-cta-fg opacity-0 transition-all duration-300 group-hover:-translate-x-0 group-hover:opacity-100">
        <span>{text}</span>
        <ArrowRightIcon className="h-4 w-4" />
      </div>
      <div
        className={cn(
          "absolute left-[20%] top-[40%] h-2 w-2 scale-100 rounded-full transition-all duration-300",
          variant === "primary"
            ? "bg-ink group-hover:left-0 group-hover:top-0 group-hover:h-full group-hover:w-full group-hover:scale-[1.8]"
            : "bg-cta group-hover:left-0 group-hover:top-0 group-hover:h-full group-hover:w-full group-hover:scale-[1.8]"
        )}
      />
    </>
  );

  const buttonClasses = cn(
    "group relative cursor-pointer overflow-hidden rounded-full border p-3 px-6 text-center text-sm font-semibold transition-all",
    variant === "primary"
      ? "border-transparent bg-cta text-cta-fg hover:shadow-lg hover:shadow-cta/25"
      : "border-stroke bg-surface text-ink hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10",
    className
  );

  if (href) {
    return (
      <a href={href} className={buttonClasses}>
        {buttonContent}
      </a>
    );
  }

  return (
    <button ref={ref} className={buttonClasses} {...props}>
      {buttonContent}
    </button>
  );
});

InteractiveButton.displayName = "InteractiveButton";

export { InteractiveButton };
