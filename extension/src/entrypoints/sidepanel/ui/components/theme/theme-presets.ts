import type { ThemeDot, ThemeHarmony } from "@shared/types/settings.js";

type PresetPreview = {
  c1: string;
  c2: string;
  c3: string;
};

export type ThemePreset = {
  numDots: 1 | 3;
  algo: ThemeHarmony;
  lightness: number;
  position: { x: number; y: number };
  color?: string;
  preview?: PresetPreview;
  type?: ThemeDot["type"];
};

const BASE_PRESET_SIZE = 380;
const normalizePos = (value: number) => value / BASE_PRESET_SIZE;
const BW_PRESETS = [
  { x: 337.5, color: "rgb(224, 224, 224)" },
  { x: 337.5, color: "rgb(224, 224, 224)" },
  { x: 315, color: "rgb(192, 192, 192)" },
  { x: 292.5, color: "rgb(160, 160, 160)" },
  { x: 270, color: "rgb(128, 128, 128)" },
  { x: 247.5, color: "rgb(96, 96, 96)" },
  { x: 225, color: "rgb(64, 64, 64)" },
  { x: 202.5, color: "rgb(32, 32, 32)" },
  { x: 180, color: "rgb(0, 0, 0)" },
];

export const PRESET_PAGES: ThemePreset[][] = [
  [
    {
      numDots: 1,
      algo: "floating",
      lightness: 90,
      position: { x: normalizePos(240), y: normalizePos(240) },
      color: "#f4efdf",
    },
    {
      numDots: 1,
      algo: "floating",
      lightness: 80,
      position: { x: normalizePos(233), y: normalizePos(157) },
      color: "#f0b8cd",
    },
    {
      numDots: 1,
      algo: "floating",
      lightness: 80,
      position: { x: normalizePos(236), y: normalizePos(111) },
      color: "#e9c3e3",
    },
    {
      numDots: 1,
      algo: "floating",
      lightness: 70,
      position: { x: normalizePos(234), y: normalizePos(173) },
      color: "#da7682",
    },
    {
      numDots: 1,
      algo: "floating",
      lightness: 70,
      position: { x: normalizePos(220), y: normalizePos(187) },
      color: "#eb8570",
    },
    {
      numDots: 1,
      algo: "floating",
      lightness: 60,
      position: { x: normalizePos(225), y: normalizePos(237) },
      color: "#dcce7f",
    },
    {
      numDots: 1,
      algo: "floating",
      lightness: 60,
      position: { x: normalizePos(147), y: normalizePos(195) },
      color: "#5becad",
    },
    {
      numDots: 1,
      algo: "floating",
      lightness: 50,
      position: { x: normalizePos(81), y: normalizePos(84) },
      color: "#919bb5",
    },
  ],
  [
    {
      numDots: 3,
      algo: "analogous",
      lightness: 90,
      position: { x: normalizePos(240), y: normalizePos(240) },
      preview: { c1: "rgb(245, 237, 214)", c2: "rgb(221, 243, 216)", c3: "rgb(243, 216, 225)" },
    },
    {
      numDots: 3,
      algo: "analogous",
      lightness: 85,
      position: { x: normalizePos(233), y: normalizePos(157) },
      preview: { c1: "rgb(243, 190, 222)", c2: "rgb(247, 222, 186)", c3: "rgb(223, 195, 238)" },
    },
    {
      numDots: 3,
      algo: "analogous",
      lightness: 80,
      position: { x: normalizePos(236), y: normalizePos(111) },
      preview: { c1: "rgb(229, 179, 228)", c2: "rgb(236, 172, 178)", c3: "rgb(197, 185, 223)" },
    },
    {
      numDots: 3,
      algo: "analogous",
      lightness: 70,
      position: { x: normalizePos(234), y: normalizePos(173) },
      preview: { c1: "rgb(235, 122, 159)", c2: "rgb(239, 239, 118)", c3: "rgb(210, 133, 224)" },
    },
    {
      numDots: 3,
      algo: "analogous",
      lightness: 70,
      position: { x: normalizePos(220), y: normalizePos(187) },
      preview: { c1: "rgb(242, 115, 123)", c2: "rgb(175, 242, 115)", c3: "rgb(230, 125, 232)" },
    },
    {
      numDots: 3,
      algo: "analogous",
      lightness: 60,
      position: { x: normalizePos(225), y: normalizePos(237) },
      preview: { c1: "rgb(221, 205, 85)", c2: "rgb(97, 212, 94)", c3: "rgb(215, 91, 124)" },
    },
    {
      numDots: 3,
      algo: "analogous",
      lightness: 60,
      position: { x: normalizePos(147), y: normalizePos(195) },
      preview: { c1: "rgb(75, 231, 210)", c2: "rgb(84, 175, 222)", c3: "rgb(62, 244, 112)" },
    },
    {
      numDots: 3,
      algo: "analogous",
      lightness: 55,
      position: { x: normalizePos(81), y: normalizePos(84) },
      preview: { c1: "rgb(122, 132, 158)", c2: "rgb(137, 117, 164)", c3: "rgb(116, 162, 164)" },
    },
  ],
  [
    {
      numDots: 1,
      algo: "floating",
      lightness: 10,
      position: { x: normalizePos(171), y: normalizePos(72) },
      color: "rgb(93, 86, 106)",
    },
    {
      numDots: 1,
      algo: "floating",
      lightness: 40,
      position: { x: normalizePos(265), y: normalizePos(79) },
      color: "#997096",
    },
    {
      numDots: 1,
      algo: "floating",
      lightness: 35,
      position: { x: normalizePos(301), y: normalizePos(176) },
      color: "#956066",
    },
    {
      numDots: 1,
      algo: "floating",
      lightness: 30,
      position: { x: normalizePos(237), y: normalizePos(210) },
      color: "#9c6645",
    },
    {
      numDots: 1,
      algo: "floating",
      lightness: 30,
      position: { x: normalizePos(91), y: normalizePos(228) },
      color: "#517b6c",
    },
    {
      numDots: 1,
      algo: "floating",
      lightness: 25,
      position: { x: normalizePos(67), y: normalizePos(159) },
      color: "#576e75",
    },
    {
      numDots: 1,
      algo: "floating",
      lightness: 20,
      position: { x: normalizePos(314), y: normalizePos(235) },
      color: "rgb(131, 109, 95)",
    },
    {
      numDots: 1,
      algo: "floating",
      lightness: 20,
      position: { x: normalizePos(118), y: normalizePos(215) },
      color: "#447464",
    },
  ],
  [
    {
      numDots: 3,
      algo: "analogous",
      lightness: 10,
      position: { x: normalizePos(171), y: normalizePos(72) },
      preview: { c1: "rgb(23, 17, 34)", c2: "rgb(37, 14, 35)", c3: "rgb(18, 22, 33)" },
    },
    {
      numDots: 3,
      algo: "analogous",
      lightness: 40,
      position: { x: normalizePos(265), y: normalizePos(79) },
      preview: { c1: "rgb(128, 76, 124)", c2: "rgb(141, 63, 66)", c3: "rgb(97, 88, 116)" },
    },
    {
      numDots: 3,
      algo: "analogous",
      lightness: 35,
      position: { x: normalizePos(301), y: normalizePos(176) },
      preview: { c1: "rgb(122, 56, 64)", c2: "rgb(126, 121, 52)", c3: "rgb(111, 68, 110)" },
    },
    {
      numDots: 3,
      algo: "analogous",
      lightness: 30,
      position: { x: normalizePos(237), y: normalizePos(210) },
      preview: { c1: "rgb(131, 65, 22)", c2: "rgb(64, 128, 25)", c3: "rgb(122, 31, 91)" },
    },
    {
      numDots: 3,
      algo: "analogous",
      lightness: 30,
      position: { x: normalizePos(91), y: normalizePos(228) },
      preview: { c1: "rgb(45, 108, 85)", c2: "rgb(52, 85, 101)", c3: "rgb(52, 118, 35)" },
    },
    {
      numDots: 3,
      algo: "analogous",
      lightness: 25,
      position: { x: normalizePos(67), y: normalizePos(159) },
      preview: { c1: "rgb(45, 74, 83)", c2: "rgb(46, 50, 81)", c3: "rgb(38, 90, 65)" },
    },
    {
      numDots: 3,
      algo: "analogous",
      lightness: 20,
      position: { x: normalizePos(314), y: normalizePos(235) },
      preview: { c1: "rgb(64, 47, 38)", c2: "rgb(55, 64, 38)", c3: "rgb(59, 43, 52)" },
    },
    {
      numDots: 3,
      algo: "analogous",
      lightness: 20,
      position: { x: normalizePos(118), y: normalizePos(215) },
      preview: { c1: "rgb(22, 80, 61)", c2: "rgb(26, 60, 76)", c3: "rgb(27, 87, 15)" },
    },
  ],
  BW_PRESETS.map((preset) => ({
    numDots: 1 as const,
    algo: "floating" as const,
    lightness: 50,
    position: { x: normalizePos(preset.x), y: normalizePos(180) },
    color: preset.color,
    type: "explicit-black-white" as const,
  })),
];
