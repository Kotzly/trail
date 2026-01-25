import * as React from "react";
import * as hero from "hero-patterns";
import { cn } from "../utils/cn";

const patternMap = {
  topography: hero.topography,
  circuit: hero.circuitBoard,
  signal: hero.signal,
  graph: hero.graphPaper
};

export type BackgroundArtProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: keyof typeof patternMap;
};

export function BackgroundArt({ className, variant = "topography", ...props }: BackgroundArtProps) {
  const pattern = patternMap[variant] ?? hero.topography;
  const lightPattern = pattern("#0b0d11", 0.12);
  const darkPattern = pattern("#ffffff", 0.08);

  return (
    <div
      className={cn("absolute inset-0 -z-10 overflow-hidden", className)}
      data-noise="true"
      {...props}
    >
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage: "var(--trail-gradient-1), var(--trail-gradient-2)",
          backgroundRepeat: "no-repeat",
          backgroundSize: "140% 140%"
        }}
      />
      <div
        className="absolute inset-0 opacity-70 mix-blend-soft-light dark:hidden"
        style={{
          backgroundImage: lightPattern,
          backgroundSize: "220px 220px"
        }}
      />
      <div
        className="absolute inset-0 hidden opacity-50 mix-blend-soft-light dark:block"
        style={{
          backgroundImage: darkPattern,
          backgroundSize: "220px 220px"
        }}
      />
    </div>
  );
}
