import type { ThemeId } from "./theme.js";

export type ThemeDotType = "explicit-lightness" | "explicit-black-white";

export type ThemeHarmony =
  | "floating"
  | "complementary"
  | "singleAnalogous"
  | "splitComplementary"
  | "analogous"
  | "triadic";

export type ThemeDot = {
  x: number;
  y: number;
  type?: ThemeDotType;
};

export type CustomTheme = {
  enabled: boolean;
  dots: ThemeDot[];
  harmony: ThemeHarmony;
  lightness: number;
  opacity: number;
  texture: number;
  customColors: string[];
  accentColor: string | null;
};

export type LayoutMode = "tree" | "mindmap";

export type TreeLayoutSettings = {
  verticalGapScale: number;
  horizontalGapScale: number;
  hideRoot: boolean;
};

export type MindmapLayoutSettings = {
  verticalGapScale: number;
  horizontalGapScale: number;
};

export type LayoutSettings = {
  mode: LayoutMode;
  tree: TreeLayoutSettings;
  mindmap: MindmapLayoutSettings;
};

export type TitleTruncation = "start" | "middle" | "end";

export type GraphDensity = "compact" | "comfortable" | "spacious";

export type PrivacySettings = {
  /**
   * Hostname patterns (supports `*` wildcard, case-insensitive) that Trail
   * never records. Matches against the full hostname — a pattern like
   * `*.bank.com` blocks `login.bank.com` and `www.bank.com` but not
   * `fakebank.com`. Defaults cover common financial / health / gov
   * domains and localhost.
   */
  blocklist: string[];
  /** If true (default), skip tracking in Chrome incognito windows. */
  skipIncognito: boolean;
};

/**
 * Auto-cleanup behaviors. When enabled, Trail silently removes
 * low-value navigations to keep the map readable. User can audit
 * and restore via the Recently cleaned drawer; post-hoc revival
 * (returning to a pruned URL within 72h) re-creates the node
 * automatically.
 */
export type CleanupSettings = {
  /** "Quick-peek" auto-prune: drop single-visit short-dwell nodes. */
  glance: {
    enabled: boolean;
    /** Dwell strictly under this, in ms, makes a node eligible. */
    thresholdMs: number;
  };
  /** Burst consolidation: group rapid feed-style navigation. */
  burst: {
    enabled: boolean;
    /** Minimum streak length for container consolidation. */
    minItems: number;
  };
  /** Round-trip suppression: A→B→A short-circuits to just A. */
  roundTrip: {
    enabled: boolean;
  };
  /** Domains (supports * wildcards) that are never auto-cleaned. */
  allowDomains: string[];
};

export type Settings = {
  theme: ThemeId;
  customTheme: CustomTheme;
  layout: LayoutSettings;
  titleTruncation: TitleTruncation;
  graphDensity: GraphDensity;
  showFavicons: boolean;
  showUrls: boolean;
  showTagDots: boolean;
  showTabCounts: boolean;
  showAudioIndicators: boolean;
  showConnections: boolean;
  dimClosedNodes: boolean;
  confirmNewTree: boolean;
  shortcutsEnabled: boolean;
  adaptivePerformance: boolean;
  keepTabsOnSwitch: boolean;
  privacy: PrivacySettings;
  cleanup: CleanupSettings;
};
