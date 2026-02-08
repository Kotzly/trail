import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "../../icons";
import { cn } from "../../utils/cn";

interface GetTrailButtonProps {
  href?: string;
  className?: string;
  children?: React.ReactNode;
  showIcon?: boolean;
}

export function GetTrailButton({
  href = "/downloads",
  className,
  children = "Get Trail",
  showIcon = true,
}: GetTrailButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cta px-6 text-sm font-semibold text-cta-fg transition-all hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base",
        className,
      )}
    >
      {children}
      {showIcon ? (
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      ) : null}
    </Link>
  );
}
