import * as React from "react";

import { BackgroundArt, cn } from "@trail/ui";
import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";

export function LegalPageShell({
  children,
  variant = "topography",
}: {
  children: React.ReactNode;
  variant?: "topography" | "circuit" | "signal" | "graph";
}) {
  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className={cn("relative overflow-hidden")}>
        <BackgroundArt variant={variant} />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-12 h-40 w-40 rounded-full bg-ink/5 blur-3xl float-slow" />
          <div className="absolute right-10 top-24 h-56 w-56 rounded-full bg-ink/10 blur-3xl float-slower" />
          <div className="absolute bottom-10 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-ink/5 blur-3xl float-slow" />
        </div>
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}

