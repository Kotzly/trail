import { THEME_IDS } from "@features/themes/model.js";
import type { Settings } from "@shared/types/settings.js";
import { DEFAULT_LAYOUT_SETTINGS } from "@shared/layout/defaults.js";
import { settingsItem } from "@shared/config/storage-items.js";
import { createLogger } from "@shared/lib/logger.js";
import { DEFAULT_THEME_PRESET, isKnownPresetId } from "@shared/styles/theme-presets.js";

const log = createLogger("settings");

export const defaultSettings: Settings = {
  theme: THEME_IDS.SYSTEM,
  themePreset: "default",
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
    // Sites whose URLs change rapidly (translators, live-search apps) —
    // linear chains of matching navigations are visually folded in the
    // graph so they don't overwhelm the tree. Users can add their own.
    // `*translat*` covers translate.*, deepl.com/translator, bing.com/translator,
    // translation/translated paths, etc. See url-blocklist.ts for full syntax.
    collapselist: ["*translat*"],
    // Default to regular web pages only. Matches the legacy hardcoded
    // allowlist; users can add `file:`, `chrome-extension:`, etc.
    trackedSchemes: ["http:", "https:"],
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
    themePreset: isKnownPresetId(sanitized.themePreset)
      ? sanitized.themePreset
      : DEFAULT_THEME_PRESET,
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
      collapselist:
        Array.isArray(sanitized.privacy?.collapselist) &&
        sanitized.privacy.collapselist.every((x) => typeof x === "string")
          ? sanitized.privacy.collapselist
          : defaultSettings.privacy.collapselist,
      trackedSchemes:
        Array.isArray(sanitized.privacy?.trackedSchemes) &&
        sanitized.privacy.trackedSchemes.every((x) => typeof x === "string")
          ? sanitized.privacy.trackedSchemes
              .map((s) => s.trim().toLowerCase())
              .filter((s) => s.length > 0)
              .map((s) => (s.endsWith(":") ? s : `${s}:`))
          : defaultSettings.privacy.trackedSchemes,
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
    void import("../utils/url-utils.js").then(({ setUrlBlocklist, setTrackedSchemes }) => {
      setUrlBlocklist(this.settings.privacy.blocklist);
      setTrackedSchemes(this.settings.privacy.trackedSchemes);
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
