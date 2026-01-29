import * as React from "react";
import * as hero from "hero-patterns";
import { cn } from "../utils/cn";

const patternMap = {
  topography: hero.topography,
  circuit: hero.circuitBoard,
  signal: hero.signal,
  graph: hero.graphPaper,
  grid: hero.graphPaper
};

const sizeMap: Record<keyof typeof patternMap, string> = {
  topography: "240px 240px",
  circuit: "220px 220px",
  signal: "260px 260px",
  graph: "170px 170px",
  grid: "150px 150px"
};

export type BackgroundArtProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: keyof typeof patternMap;
};

export function BackgroundArt({ className, variant = "topography", ...props }: BackgroundArtProps) {
  const pattern = patternMap[variant] ?? hero.topography;
  const size = sizeMap[variant] ?? "220px 220px";
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
          backgroundSize: size
        }}
      />
      <div
        className="absolute inset-0 hidden opacity-50 mix-blend-soft-light dark:block"
        style={{
          backgroundImage: darkPattern,
          backgroundSize: size
        }}
      />
    </div>
  );
}
