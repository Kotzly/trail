import { loadFont as loadSyne } from "@remotion/google-fonts/Syne";
import { loadFont as loadCormorant } from "@remotion/google-fonts/Cormorant";
import { loadFont as loadDMMono } from "@remotion/google-fonts/DMMono";

/**
 * Load all three fonts and capture the exact fontFamily strings
 * that Remotion provides. Components should use these rather
 * than bare font name strings.
 */
const { fontFamily: syneFontFamily } = loadSyne();
const { fontFamily: cormorantFontFamily } = loadCormorant();
const { fontFamily: dmMonoFontFamily } = loadDMMono();

export const theme = {
  void: "#060810",
  surface: "#0E1118",
  ink: "#E8E4DE",
  inkMuted: "#6B6560",
  amber: "#D4A853",
  amberGlow: "rgba(212, 168, 83, 0.15)",
  amberHot: "#F0D78C",
  edgeLine: "#3A3530",
  grain: "rgba(255, 252, 245, 0.03)",
} as const;

export const fonts = {
  display: syneFontFamily,
  narrative: cormorantFontFamily,
  mono: dmMonoFontFamily,
} as const;
