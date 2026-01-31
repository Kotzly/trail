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
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
