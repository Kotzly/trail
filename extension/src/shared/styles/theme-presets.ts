export type ThemePresetMeta = {
  id: string;
  name: string;
  /** OKLCH values of the preset's light-mode `--chart-1..4`, used as a 4-dot swatch in the picker. */
  swatch: [string, string, string, string];
};

export const DEFAULT_THEME_PRESET = "default";

export const THEME_PRESETS: ThemePresetMeta[] = [
  {
    id: "default",
    name: "Default",
    swatch: [
      "oklch(0.8348 0.1302 160.9080)",
      "oklch(0.6231 0.1880 259.8145)",
      "oklch(0.6056 0.2189 292.7172)",
      "oklch(0.7686 0.1647 70.0804)",
    ],
  },
  {
    id: "amber-minimal",
    name: "Amber Minimal",
    swatch: [
      "oklch(0.77 0.16 70.08)",
      "oklch(0.67 0.16 58.32)",
      "oklch(0.56 0.15 49)",
      "oklch(0.47 0.12 46.2)",
    ],
  },
  {
    id: "bold-tech",
    name: "Bold Tech",
    swatch: [
      "oklch(0.61 0.22 292.72)",
      "oklch(0.54 0.25 293.01)",
      "oklch(0.49 0.24 292.58)",
      "oklch(0.43 0.21 292.76)",
    ],
  },
  {
    id: "bubblegum",
    name: "Bubblegum",
    swatch: [
      "oklch(0.7 0.16 350.75)",
      "oklch(0.82 0.08 212.09)",
      "oklch(0.92 0.08 87.67)",
      "oklch(0.8 0.11 348.18)",
    ],
  },
  {
    id: "caffeine",
    name: "Caffeine",
    swatch: [
      "oklch(0.43 0.04 41.99)",
      "oklch(0.92 0.07 74.37)",
      "oklch(0.93 0 0)",
      "oklch(0.94 0.05 75.5)",
    ],
  },
  {
    id: "candyland",
    name: "Candyland",
    swatch: [
      "oklch(0.87 0.07 7.09)",
      "oklch(0.81 0.08 225.75)",
      "oklch(0.97 0.21 109.77)",
      "oklch(0.8 0.14 349.23)",
    ],
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    swatch: [
      "oklch(0.55 0.25 297.02)",
      "oklch(0.68 0.14 235.38)",
      "oklch(0.63 0.18 140.44)",
      "oklch(0.69 0.2 42.43)",
    ],
  },
  {
    id: "claude",
    name: "Claude",
    swatch: [
      "oklch(0.56 0.13 43)",
      "oklch(0.69 0.16 290.41)",
      "oklch(0.88 0.03 93.13)",
      "oklch(0.88 0.04 298.18)",
    ],
  },
  {
    id: "claymorphism",
    name: "Claymorphism",
    swatch: [
      "oklch(0.59 0.2 277.12)",
      "oklch(0.51 0.23 276.97)",
      "oklch(0.46 0.21 277.02)",
      "oklch(0.4 0.18 277.37)",
    ],
  },
  {
    id: "clean-slate",
    name: "Clean Slate",
    swatch: [
      "oklch(0.59 0.2 277.12)",
      "oklch(0.51 0.23 276.97)",
      "oklch(0.46 0.21 277.02)",
      "oklch(0.4 0.18 277.37)",
    ],
  },
  {
    id: "cosmic-night",
    name: "Cosmic Night",
    swatch: [
      "oklch(0.54 0.18 288.03)",
      "oklch(0.7 0.16 288.99)",
      "oklch(0.57 0.21 276.71)",
      "oklch(0.64 0.19 281.81)",
    ],
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    swatch: [
      "oklch(0.67 0.29 341.41)",
      "oklch(0.55 0.29 299.1)",
      "oklch(0.84 0.15 209.29)",
      "oklch(0.89 0.17 171.27)",
    ],
  },
  {
    id: "doom-64",
    name: "Doom 64",
    swatch: [
      "oklch(0.5 0.19 27.48)",
      "oklch(0.5 0.09 126.19)",
      "oklch(0.59 0.1 245.74)",
      "oklch(0.71 0.2 46.46)",
    ],
  },
  {
    id: "elegant-luxury",
    name: "Elegant Luxury",
    swatch: [
      "oklch(0.51 0.19 27.52)",
      "oklch(0.47 0.15 24.94)",
      "oklch(0.4 0.13 25.72)",
      "oklch(0.56 0.15 49)",
    ],
  },
  {
    id: "github",
    name: "GitHub",
    swatch: [
      "oklch(0.50 0.15 145)",
      "oklch(0.57 0.18 260)",
      "oklch(0.65 0.15 320)",
      "oklch(0.70 0.12 40)",
    ],
  },
  {
    id: "graphite",
    name: "Graphite",
    swatch: ["oklch(0.49 0 0)", "oklch(0.49 0.04 196.03)", "oklch(0.65 0 0)", "oklch(0.73 0 0)"],
  },
  {
    id: "kick",
    name: "Kick",
    swatch: [
      "oklch(0.75 0.28 128)",
      "oklch(0.65 0.2 180)",
      "oklch(0.7 0.18 220)",
      "oklch(0.6 0.15 280)",
    ],
  },
  {
    id: "kodama-grove",
    name: "Kodama Grove",
    swatch: [
      "oklch(0.73 0.06 130.85)",
      "oklch(0.68 0.06 132.45)",
      "oklch(0.82 0.03 136.65)",
      "oklch(0.59 0.05 137.62)",
    ],
  },
  {
    id: "midnight-bloom",
    name: "Midnight Bloom",
    swatch: [
      "oklch(0.57 0.2 283.08)",
      "oklch(0.53 0.17 314.65)",
      "oklch(0.34 0.18 301.68)",
      "oklch(0.67 0.14 261.34)",
    ],
  },
  {
    id: "mocha-mousse",
    name: "Mocha Mousse",
    swatch: [
      "oklch(0.61 0.06 44.36)",
      "oklch(0.54 0.05 37.21)",
      "oklch(0.73 0.05 52.33)",
      "oklch(0.75 0.04 80.55)",
    ],
  },
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    swatch: [
      "oklch(0.62 0.19 259.81)",
      "oklch(0.55 0.22 262.88)",
      "oklch(0.49 0.22 264.38)",
      "oklch(0.42 0.18 265.64)",
    ],
  },
  {
    id: "mono",
    name: "Mono",
    swatch: ["oklch(0.56 0 0)", "oklch(0.56 0 0)", "oklch(0.56 0 0)", "oklch(0.56 0 0)"],
  },
  {
    id: "nature",
    name: "Nature",
    swatch: [
      "oklch(0.67 0.16 144.21)",
      "oklch(0.58 0.14 144.18)",
      "oklch(0.52 0.13 144.17)",
      "oklch(0.43 0.12 144.31)",
    ],
  },
  {
    id: "neo-brutalism",
    name: "Neo-Brutalism",
    swatch: [
      "oklch(0.65 0.24 26.97)",
      "oklch(0.97 0.21 109.77)",
      "oklch(0.56 0.24 260.82)",
      "oklch(0.73 0.25 142.5)",
    ],
  },
  {
    id: "northern-lights",
    name: "Northern Lights",
    swatch: [
      "oklch(0.65 0.15 150.31)",
      "oklch(0.67 0.14 261.34)",
      "oklch(0.83 0.11 211.96)",
      "oklch(0.59 0.1 245.74)",
    ],
  },
  {
    id: "ocean-breeze",
    name: "Ocean Breeze",
    swatch: [
      "oklch(0.72 0.19 149.58)",
      "oklch(0.7 0.15 162.48)",
      "oklch(0.6 0.13 163.23)",
      "oklch(0.51 0.1 165.61)",
    ],
  },
  {
    id: "pastel-dreams",
    name: "Pastel Dreams",
    swatch: [
      "oklch(0.71 0.16 293.54)",
      "oklch(0.61 0.22 292.72)",
      "oklch(0.54 0.25 293.01)",
      "oklch(0.49 0.24 292.58)",
    ],
  },
  {
    id: "perpetuity",
    name: "Perpetuity",
    swatch: [
      "oklch(0.56 0.09 203.28)",
      "oklch(0.64 0.1 201.59)",
      "oklch(0.71 0.11 201.25)",
      "oklch(0.77 0.1 201.18)",
    ],
  },
  {
    id: "quantum-rose",
    name: "Quantum Rose",
    swatch: [
      "oklch(0.6 0.24 0.13)",
      "oklch(0.6 0.17 345.04)",
      "oklch(0.6 0.12 311.8)",
      "oklch(0.58 0.12 283.29)",
    ],
  },
  {
    id: "retro-arcade",
    name: "Retro Arcade",
    swatch: [
      "oklch(0.61 0.14 244.93)",
      "oklch(0.64 0.1 187.38)",
      "oklch(0.59 0.2 355.89)",
      "oklch(0.58 0.17 39.5)",
    ],
  },
  {
    id: "solar-dusk",
    name: "Solar Dusk",
    swatch: [
      "oklch(0.56 0.15 49)",
      "oklch(0.55 0.01 58.07)",
      "oklch(0.55 0.12 66.44)",
      "oklch(0.55 0.01 58.07)",
    ],
  },
  {
    id: "spotify",
    name: "Spotify",
    swatch: [
      "oklch(0.64 0.18 152)",
      "oklch(0.72 0.20 150)",
      "oklch(0.60 0.15 200)",
      "oklch(0.70 0.12 280)",
    ],
  },
  {
    id: "starry-night",
    name: "Starry Night",
    swatch: [
      "oklch(0.48 0.12 263.38)",
      "oklch(0.86 0.12 81.01)",
      "oklch(0.69 0.07 234.04)",
      "oklch(0.78 0.02 251.19)",
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    swatch: [
      "oklch(0.55 0.25 285)",
      "oklch(0.82 0.14 200)",
      "oklch(0.65 0.18 320)",
      "oklch(0.7 0.15 150)",
    ],
  },
  {
    id: "sunset-horizon",
    name: "Sunset Horizon",
    swatch: [
      "oklch(0.74 0.16 34.71)",
      "oklch(0.83 0.11 58)",
      "oklch(0.88 0.08 54.93)",
      "oklch(0.82 0.11 40.89)",
    ],
  },
  {
    id: "supabase",
    name: "Supabase",
    swatch: [
      "oklch(0.83 0.13 160.91)",
      "oklch(0.62 0.19 259.81)",
      "oklch(0.61 0.22 292.72)",
      "oklch(0.77 0.16 70.08)",
    ],
  },
  {
    id: "t3-chat",
    name: "T3 Chat",
    swatch: [
      "oklch(0.6 0.24 344.47)",
      "oklch(0.44 0.23 300.62)",
      "oklch(0.38 0.04 226.15)",
      "oklch(0.83 0.12 88.35)",
    ],
  },
  {
    id: "tangerine",
    name: "Tangerine",
    swatch: [
      "oklch(0.72 0.06 248.68)",
      "oklch(0.79 0.09 35.96)",
      "oklch(0.58 0.08 254.16)",
      "oklch(0.5 0.08 259.49)",
    ],
  },
  {
    id: "twitch",
    name: "Twitch",
    swatch: [
      "oklch(0.54 0.27 290)",
      "oklch(0.48 0.26 290)",
      "oklch(0.65 0.18 200)",
      "oklch(0.7 0.15 150)",
    ],
  },
  {
    id: "twitter",
    name: "Twitter",
    swatch: [
      "oklch(0.67 0.16 245)",
      "oklch(0.69 0.16 160.35)",
      "oklch(0.82 0.16 82.53)",
      "oklch(0.71 0.18 151.71)",
    ],
  },
  {
    id: "vercel",
    name: "Vercel",
    swatch: [
      "oklch(0.81 0.17 75.35)",
      "oklch(0.55 0.22 264.53)",
      "oklch(0.72 0 0)",
      "oklch(0.92 0 0)",
    ],
  },
  {
    id: "vintage-paper",
    name: "Vintage Paper",
    swatch: [
      "oklch(0.62 0.08 65.54)",
      "oklch(0.56 0.06 68.58)",
      "oklch(0.49 0.06 72.68)",
      "oklch(0.68 0.06 64.78)",
    ],
  },
  {
    id: "windows98",
    name: "Windows 98",
    swatch: [
      "oklch(0.2711 0.1879 264.052)",
      "oklch(0.5198 0.1769 142.4953)",
      "oklch(0.4209 0.1935 328.3634)",
      "oklch(0.628 0.2577 29.2339)",
    ],
  },
];

const KNOWN_PRESET_IDS = new Set(THEME_PRESETS.map((p) => p.id));

export function isKnownPresetId(value: unknown): value is string {
  return typeof value === "string" && KNOWN_PRESET_IDS.has(value);
}
