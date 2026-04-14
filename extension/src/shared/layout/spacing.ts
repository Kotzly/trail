import type { Settings } from "@shared/types/settings.js";

export type GraphDensity = Settings["graphDensity"];

export function getSpacing(density: GraphDensity): {
  nodeSpacing: number;
  layerSpacing: number;
} {
  switch (density) {
    case "compact":
      return { nodeSpacing: 16, layerSpacing: 60 };
    case "spacious":
      return { nodeSpacing: 32, layerSpacing: 100 };
    case "comfortable":
    default:
      return { nodeSpacing: 24, layerSpacing: 80 };
  }
}
