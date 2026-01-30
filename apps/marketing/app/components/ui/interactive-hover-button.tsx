"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@trail/ui";

interface InteractiveHoverButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string;
  href?: string;
}

const InteractiveHoverButton = React.forwardRef<
  HTMLButtonElement,
  InteractiveHoverButtonProps
>(({ text = "Button", className, href, ...props }, ref) => {
  const classes = cn(
    "group relative inline-flex min-w-[9.5rem] items-center justify-center overflow-hidden rounded-full border border-stroke/60 bg-surface px-5 py-2.5 text-sm font-semibold text-ink shadow-elev-1 transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40",
    className
  );
  const { onClick, disabled, type: _type, ...rest } = props;
  const anchorProps = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        onClick={onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined}
        {...anchorProps}
      >
        <span className="inline-block translate-x-1 transition-all duration-300 group-hover:translate-x-10 group-hover:opacity-0">
          {text}
        </span>
        <span className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-[color:rgb(var(--cta-fg))] opacity-0 transition-all duration-300 group-hover:opacity-100">
          <span>{text}</span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
        <span className="absolute left-[20%] top-[40%] h-2 w-2 rounded-lg bg-ink transition-all duration-300 group-hover:left-0 group-hover:top-0 group-hover:h-full group-hover:w-full group-hover:scale-[1.6]" />
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      className={classes}
      type="button"
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      <span className="inline-block translate-x-1 transition-all duration-300 group-hover:translate-x-10 group-hover:opacity-0">
        {text}
      </span>
      <span className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-[color:rgb(var(--cta-fg))] opacity-0 transition-all duration-300 group-hover:opacity-100">
        <span>{text}</span>
        <ArrowRight className="h-4 w-4" aria-hidden />
      </span>
      <span className="absolute left-[20%] top-[40%] h-2 w-2 rounded-lg bg-ink transition-all duration-300 group-hover:left-0 group-hover:top-0 group-hover:h-full group-hover:w-full group-hover:scale-[1.6]" />
    </button>
  );
});

InteractiveHoverButton.displayName = "InteractiveHoverButton";

export { InteractiveHoverButton };
