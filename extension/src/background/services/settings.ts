import { THEME_IDS } from "@features/themes/model.js";
import type { CustomTheme, Settings, ThemeHarmony, ThemeDotType } from "@shared/types/settings.js";
import { DEFAULT_LAYOUT_SETTINGS } from "@shared/layout/defaults.js";
import { settingsItem } from "@shared/config/storage-items.js";
import { createLogger } from "@shared/lib/logger.js";

const log = createLogger("settings");

const DEFAULT_CUSTOM_THEME: CustomTheme = {
  enabled: false,
  dots: [],
  harmony: "floating",
  lightness: 50,
  opacity: 0.6,
  texture: 0,
  customColors: [],
  accentColor: null,
};

const THEME_HARMONIES: ThemeHarmony[] = [
  "floating",
  "complementary",
  "singleAnalogous",
  "splitComplementary",
  "analogous",
  "triadic",
];

const THEME_DOT_TYPES: ThemeDotType[] = ["explicit-lightness", "explicit-black-white"];

const clamp01 = (value: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : fallback;

const clamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;

function normalizeCustomTheme(raw: unknown): CustomTheme {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_CUSTOM_THEME };
  }
  const partial = raw as Partial<CustomTheme>;
  const rawDots = Array.isArray(partial.dots) ? partial.dots : DEFAULT_CUSTOM_THEME.dots;
  const dots = rawDots
    .map((dot) => {
      const dotType = THEME_DOT_TYPES.includes(dot?.type as ThemeDotType)
        ? (dot?.type as ThemeDotType)
        : undefined;
      return {
        x: clamp(dot?.x ?? 0.5, 0, 1, 0.5),
        y: clamp(dot?.y ?? 0.5, 0, 1, 0.5),
        ...(dotType ? { type: dotType } : {}),
      };
    })
    .slice(0, 3);
  return {
    ...DEFAULT_CUSTOM_THEME,
    ...partial,
    enabled: Boolean(partial.enabled),
    dots: dots.length ? dots : DEFAULT_CUSTOM_THEME.dots,
    harmony: THEME_HARMONIES.includes(partial.harmony as ThemeHarmony)
      ? (partial.harmony as ThemeHarmony)
      : DEFAULT_CUSTOM_THEME.harmony,
    lightness: clamp(partial.lightness ?? DEFAULT_CUSTOM_THEME.lightness, 0, 100, 50),
    opacity: clamp01(partial.opacity ?? DEFAULT_CUSTOM_THEME.opacity, DEFAULT_CUSTOM_THEME.opacity),
    texture: clamp01(partial.texture ?? DEFAULT_CUSTOM_THEME.texture, DEFAULT_CUSTOM_THEME.texture),
    customColors: Array.isArray(partial.customColors)
      ? partial.customColors
          .filter((color) => typeof color === "string" && color.trim().length > 0)
          .slice(0, 4)
      : DEFAULT_CUSTOM_THEME.customColors,
    accentColor:
      typeof partial.accentColor === "string" &&
      /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(partial.accentColor)
        ? partial.accentColor
        : DEFAULT_CUSTOM_THEME.accentColor,
  };
}

export const defaultSettings: Settings = {
  theme: THEME_IDS.SYSTEM,
  customTheme: { ...DEFAULT_CUSTOM_THEME },
  layout: {
    mode: DEFAULT_LAYOUT_SETTINGS.mode,
    tree: { ...DEFAULT_LAYOUT_SETTINGS.tree },
    mindmap: { ...DEFAULT_LAYOUT_SETTINGS.mindmap },
  },
  titleTruncation: "end",
  graphDensity: "comfortable",
  showFavicons: true,
  showUrls: true,
  showTagDots: true,
  showTabCounts: true,
  showAudioIndicators: true,
  showConnections: true,
  dimClosedNodes: true,
  confirmNewTree: true,
  shortcutsEnabled: true,
  adaptivePerformance: true,
  keepTabsOnSwitch: true,
  privacy: {
    // Sensible defaults biased toward privacy. Users can remove any of
    // these in Settings → Privacy.
    blocklist: [
      "localhost",
      "127.0.0.1",
      "*.local",
      "*.bank.com",
      "*.banking.*",
      "accounts.google.com",
      "login.microsoftonline.com",
      "*.healthcare.gov",
      "*.irs.gov",
    ],
    skipIncognito: true,
  },
  cleanup: {
    glance: { enabled: true, thresholdMs: 5_000 },
    roundTrip: { enabled: true },
  },
};

function mergeDefaults(raw: unknown): Settings {
  if (!raw || typeof raw !== "object") {
    return { ...defaultSettings };
  }
  const partial = raw as Partial<Settings> & {
    adaptiveMode?: unknown;
    adaptiveModeLayouts?: unknown;
  };
  const {
    adaptiveMode: _adaptiveMode,
    adaptiveModeLayouts: _adaptiveModeLayouts,
    ...rest
  } = partial;
  const sanitized = rest as Partial<Settings>;
  const layout = sanitized.layout ?? DEFAULT_LAYOUT_SETTINGS;
  const storedMode = (layout as { mode?: string }).mode;
  const normalizedMode =
    storedMode === "tree" || storedMode === "mindmap" ? storedMode : DEFAULT_LAYOUT_SETTINGS.mode;
  return {
    ...defaultSettings,
    ...sanitized,
    customTheme: normalizeCustomTheme(sanitized.customTheme),
    layout: {
      mode: normalizedMode,
      tree: {
        ...DEFAULT_LAYOUT_SETTINGS.tree,
        ...(layout.tree ?? {}),
      },
      mindmap: {
        ...DEFAULT_LAYOUT_SETTINGS.mindmap,
        ...(layout.mindmap ?? {}),
      },
    },
    titleTruncation: sanitized.titleTruncation ?? defaultSettings.titleTruncation,
    graphDensity: sanitized.graphDensity ?? defaultSettings.graphDensity,
    showFavicons: sanitized.showFavicons ?? defaultSettings.showFavicons,
    showUrls: sanitized.showUrls ?? defaultSettings.showUrls,
    showTagDots: sanitized.showTagDots ?? defaultSettings.showTagDots,
    showTabCounts: sanitized.showTabCounts ?? defaultSettings.showTabCounts,
    showAudioIndicators: sanitized.showAudioIndicators ?? defaultSettings.showAudioIndicators,
    showConnections: sanitized.showConnections ?? defaultSettings.showConnections,
    dimClosedNodes: sanitized.dimClosedNodes ?? defaultSettings.dimClosedNodes,
    confirmNewTree: sanitized.confirmNewTree ?? defaultSettings.confirmNewTree,
    shortcutsEnabled: sanitized.shortcutsEnabled ?? defaultSettings.shortcutsEnabled,
    adaptivePerformance: sanitized.adaptivePerformance ?? defaultSettings.adaptivePerformance,
    keepTabsOnSwitch: sanitized.keepTabsOnSwitch ?? defaultSettings.keepTabsOnSwitch,
    privacy: {
      blocklist:
        Array.isArray(sanitized.privacy?.blocklist) &&
        sanitized.privacy.blocklist.every((x) => typeof x === "string")
          ? sanitized.privacy.blocklist
          : defaultSettings.privacy.blocklist,
      skipIncognito:
        typeof sanitized.privacy?.skipIncognito === "boolean"
          ? sanitized.privacy.skipIncognito
          : defaultSettings.privacy.skipIncognito,
    },
    cleanup: {
      glance: {
        enabled:
          typeof sanitized.cleanup?.glance?.enabled === "boolean"
            ? sanitized.cleanup.glance.enabled
            : defaultSettings.cleanup.glance.enabled,
        thresholdMs:
          typeof sanitized.cleanup?.glance?.thresholdMs === "number" &&
          Number.isFinite(sanitized.cleanup.glance.thresholdMs) &&
          sanitized.cleanup.glance.thresholdMs >= 0
            ? sanitized.cleanup.glance.thresholdMs
            : defaultSettings.cleanup.glance.thresholdMs,
      },
      roundTrip: {
        enabled:
          typeof sanitized.cleanup?.roundTrip?.enabled === "boolean"
            ? sanitized.cleanup.roundTrip.enabled
            : defaultSettings.cleanup.roundTrip.enabled,
      },
    },
  };
}

class SettingsManager {
  private settings: Settings = { ...defaultSettings };

  /**
   * Resolves once `init()` has finished its first successful load.
   * Navigation and lifecycle handlers await this (or check isReady)
   * before consulting the blocklist so Chrome events arriving during
   * the service-worker boot window aren't silently dropped or
   * silently allowed past a stale blocklist.
   */
  readonly ready: Promise<void>;
  private resolveReady!: () => void;
  private readyResolved = false;

  constructor() {
    this.ready = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });
  }

  isReady(): boolean {
    return this.readyResolved;
  }

  async init(): Promise<void> {
    await this.loadSettings();
    if (!this.readyResolved) {
      this.readyResolved = true;
      this.resolveReady();
    }
    // Watch for out-of-band writes (from other extension contexts —
    // onboarding, settings page RPCs that bypass this manager, etc.)
    // so the background's in-memory state doesn't drift. Fixes #81.
    settingsItem.watch((value) => {
      this.settings = mergeDefaults(value);
      this.pushBlocklist();
    });
  }

  get(): Settings {
    return this.settings;
  }

  async loadSettings(): Promise<Settings> {
    try {
      const stored = await settingsItem.getValue();
      this.settings = mergeDefaults(stored);
      this.pushBlocklist();
    } catch (error) {
      log.error("Error loading settings", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    return this.settings;
  }

  async saveSettings(next: Settings): Promise<void> {
    // Merge order preserves user overrides (#82): defaults first, then
    // already-saved state, then the new patch. Future defaults added
    // to `defaultSettings` fill in only missing keys instead of
    // stomping values the user has already explicitly changed.
    const stored = await settingsItem.getValue().catch(() => null);
    const storedMerged = stored ? mergeDefaults(stored) : this.settings;
    this.settings = { ...defaultSettings, ...storedMerged, ...next };
    try {
      await settingsItem.setValue(this.settings);
      this.pushBlocklist();
    } catch (error) {
      log.error("Error saving settings", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private pushBlocklist(): void {
    // Lazy import to avoid circular dep (url-utils is deep in navigation).
    void import("../utils/url-utils.js").then(({ setUrlBlocklist }) => {
      setUrlBlocklist(this.settings.privacy.blocklist);
    });
  }

  async patch(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...this.settings, ...patch };
    await this.saveSettings(next);
    return this.settings;
  }
}

export const settingsManager = new SettingsManager();
settingsManager
  .init()
  .catch((e) => log.error("Init failed", { error: e instanceof Error ? e.message : String(e) }));
