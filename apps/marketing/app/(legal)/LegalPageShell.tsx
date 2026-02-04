import * as React from "react";

import { BackgroundArt, cn } from "@trail/ui";

export function LegalPageShell({
  children,
  variant = "topography",
}: {
  children: React.ReactNode;
  variant?: "topography" | "circuit" | "signal" | "graph";
}) {
  return (
    <div className="min-h-screen bg-base text-ink">
      <main className={cn("relative overflow-hidden")}>
        <BackgroundArt variant={variant} />
        {children}
      </main>
    </div>
  );
}
