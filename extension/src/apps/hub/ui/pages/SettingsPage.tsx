import { useCallback, useEffect, useRef, useState } from "react";
import type { RouteParams } from "../router.js";
import type { Settings, LayoutMode, TitleTruncation } from "@shared/types/settings.js";
import { DEFAULT_LAYOUT_SETTINGS } from "@shared/layout/defaults.js";
import { sendRpcMessage } from "@shared/rpc/client.js";
import { rpc } from "@shared/rpc/contracts.js";
import { FLAG_DEFS, type FlagKey, type ResolvedFlags } from "@shared/types/flags.js";
import {
  searchSuggestionsEnabledItem,
  experimentsUnlockedItem,
} from "@shared/config/storage-items.js";
import { useHubAuth } from "../hooks/useHubAuth.js";

const UNLOCK_CLICKS = 7;
const UNLOCK_WINDOW_MS = 3000;

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="hub-seg">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`hub-seg__btn${value === opt ? " hub-seg__btn--active" : ""}`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="hub-toggle" htmlFor={id}>
      <div className="hub-toggle__text">
        <div className="hub-toggle__label">{label}</div>
        {description && <div className="hub-toggle__desc">{description}</div>}
      </div>
      <div className="hub-toggle__switch">
        <input
          id={id}
          type="checkbox"
          className="hub-toggle__input"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="hub-toggle__control" aria-hidden="true" />
      </div>
    </label>
  );
}

export default function SettingsPage(_props: RouteParams) {
  const { authenticated, user } = useHubAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<number | null>(null);
  const pendingRef = useRef<Settings | null>(null);

  const [suggestionsEnabled, setSuggestionsEnabled] = useState(true);
  const [experimentsUnlocked, setExperimentsUnlocked] = useState(false);
  const [flags, setFlags] = useState<ResolvedFlags | null>(null);
  const clickTimestamps = useRef<number[]>([]);

  useEffect(() => {
    sendRpcMessage(rpc.getSettings())
      .then((res) => {
        if (res.success) setSettings(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    searchSuggestionsEnabledItem
      .getValue()
      .then((v) => setSuggestionsEnabled(v ?? true))
      .catch(() => {});

    experimentsUnlockedItem
      .getValue()
      .then((unlocked) => {
        if (unlocked) setExperimentsUnlocked(true);
      })
      .catch(() => {});

    sendRpcMessage(rpc.getFlags())
      .then((res) => {
        if (res.success) setFlags(res.data);
      })
      .catch(() => {});
  }, []);

  const flushSave = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const toSave = pendingRef.current;
    pendingRef.current = null;
    if (!toSave) return;
    try {
      await sendRpcMessage(rpc.saveSettings({ settings: toSave }));
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }, []);

  const update = useCallback(
    (partial: Partial<Settings>) => {
      if (!settings) return;
      const next = { ...settings, ...partial };
      setSettings(next);
      pendingRef.current = next;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => void flushSave(), 400);
    },
    [settings, flushSave],
  );

  useEffect(() => () => void flushSave(), [flushSave]);

  const handleTitleClick = () => {
    if (experimentsUnlocked) return;
    const now = Date.now();
    clickTimestamps.current = clickTimestamps.current
      .filter((t) => now - t < UNLOCK_WINDOW_MS)
      .concat(now);
    if (clickTimestamps.current.length >= UNLOCK_CLICKS) {
      clickTimestamps.current = [];
      setExperimentsUnlocked(true);
      experimentsUnlockedItem.setValue(true).catch(() => {});
    }
  };

  const handleFlagToggle = async (key: FlagKey, value: unknown) => {
    try {
      const res = await sendRpcMessage(rpc.setFlag({ key, value }));
      if (res.success) setFlags(res.data);
    } catch (error) {
      console.error("Failed to set flag:", error);
    }
  };

  const handleResetFlags = async () => {
    try {
      const res = await sendRpcMessage(rpc.resetFlags());
      if (res.success) setFlags(res.data);
    } catch (error) {
      console.error("Failed to reset flags:", error);
    }
  };

  if (loading) {
    return (
      <div className="hub-page">
        <h1 className="hub-page__title">Settings</h1>
        <div className="hub-empty">
          <p className="hub-empty__text">Loading...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="hub-page">
        <h1 className="hub-page__title">Settings</h1>
        <div className="hub-empty">
          <p className="hub-empty__text">
            Could not load settings. Make sure the Trail extension is installed.
          </p>
        </div>
      </div>
    );
  }

  const layout = settings.layout ?? DEFAULT_LAYOUT_SETTINGS;

  return (
    <div className="hub-page">
      <h1 className="hub-page__title" onClick={handleTitleClick}>Settings</h1>

      {/* Account section - only when signed in */}
      {authenticated && user && (
        <div className="hub-settings-card">
          <h2 className="hub-settings-card__title">Account</h2>
          <div className="hub-settings-card__row">
            <span className="hub-settings-card__label">Email</span>
            <span className="hub-settings-card__value">{user.email ?? "—"}</span>
          </div>
        </div>
      )}

      {/* Graph settings */}
      <div className="hub-settings-card">
        <h2 className="hub-settings-card__title">Graph</h2>

        <div className="hub-settings-card__section">
          <span className="hub-settings-card__label">Layout mode</span>
          <Seg
            value={layout.mode}
            options={["mindmap", "tree", "radial"] as const}
            onChange={(mode: LayoutMode) =>
              update({ layout: { ...layout, mode } })
            }
          />
        </div>

        <div className="hub-settings-card__section">
          <span className="hub-settings-card__label">Title truncation</span>
          <Seg
            value={settings.titleTruncation ?? "middle"}
            options={["start", "middle", "end"] as const}
            onChange={(v: TitleTruncation) => update({ titleTruncation: v })}
          />
        </div>

        <Toggle
          id="keep-tabs"
          label="Keep tabs on switch"
          description="Preserve open tabs when switching trees"
          checked={settings.keepTabsOnSwitch ?? true}
          onChange={(v) => update({ keepTabsOnSwitch: v })}
        />

        <Toggle
          id="show-connections"
          label="Show connections"
          checked={settings.showConnections ?? true}
          onChange={(v) => update({ showConnections: v })}
        />

        <Toggle
          id="show-favicons"
          label="Show favicons"
          checked={settings.showFavicons ?? true}
          onChange={(v) => update({ showFavicons: v })}
        />

        <Toggle
          id="dim-closed"
          label="Dim closed nodes"
          description="Reduce opacity of nodes without open tabs"
          checked={settings.dimClosedNodes ?? false}
          onChange={(v) => update({ dimClosedNodes: v })}
        />

        {layout.mode === "tree" && (
          <Toggle
            id="hide-root"
            label="Hide root paths"
            checked={layout.tree?.hideRoot ?? false}
            onChange={(v) =>
              update({ layout: { ...layout, tree: { ...layout.tree, hideRoot: v } } })
            }
          />
        )}
      </div>

      {/* Appearance */}
      <div className="hub-settings-card">
        <h2 className="hub-settings-card__title">Appearance</h2>

        <div className="hub-settings-card__section">
          <span className="hub-settings-card__label">Theme</span>
          <Seg
            value={settings.theme ?? "system"}
            options={["system", "light", "dark"] as const}
            onChange={(v) => update({ theme: v })}
          />
        </div>
      </div>

      {/* Behavior */}
      <div className="hub-settings-card">
        <h2 className="hub-settings-card__title">Behavior</h2>

        <Toggle
          id="shortcuts"
          label="Keyboard shortcuts"
          description="Enable keyboard shortcuts in the side panel"
          checked={settings.shortcutsEnabled ?? true}
          onChange={(v) => update({ shortcutsEnabled: v })}
        />

        <Toggle
          id="confirm-new-tree"
          label="Confirm new tree"
          description="Show confirmation before creating a new tree"
          checked={settings.confirmNewTree ?? false}
          onChange={(v) => update({ confirmNewTree: v })}
        />

        <Toggle
          id="adaptive-perf"
          label="Adaptive performance"
          description="Automatically reduce visual quality for large trees"
          checked={settings.adaptivePerformance ?? true}
          onChange={(v) => update({ adaptivePerformance: v })}
        />
      </div>

      {/* Search */}
      <div className="hub-settings-card">
        <h2 className="hub-settings-card__title">Search</h2>

        <Toggle
          id="search-suggestions"
          label="Search suggestions"
          description="Queries are sent to Google for suggestions"
          checked={suggestionsEnabled}
          onChange={(v) => {
            setSuggestionsEnabled(v);
            searchSuggestionsEnabledItem.setValue(v).catch(() => {});
          }}
        />
      </div>

      {/* Experiments (unlocked via 7 clicks on title) */}
      {experimentsUnlocked && flags && (
        <div className="hub-settings-card">
          <h2 className="hub-settings-card__title">Experiments</h2>

          {(Object.keys(FLAG_DEFS) as FlagKey[]).map((key) => {
            const def = FLAG_DEFS[key];
            if (def.type === "boolean") {
              return (
                <Toggle
                  key={key}
                  id={`flag-${key}`}
                  label={def.label}
                  description={def.description}
                  checked={flags[key] as boolean}
                  onChange={(v) => void handleFlagToggle(key, v)}
                />
              );
            }
            if (def.type === "variant") {
              return (
                <div key={key} className="hub-settings-card__section">
                  <span className="hub-settings-card__label">{def.label}</span>
                  <Seg
                    value={String(flags[key])}
                    options={def.variants}
                    onChange={(v) => void handleFlagToggle(key, v)}
                  />
                </div>
              );
            }
            return null;
          })}

          <div className="hub-settings-card__section">
            <button
              type="button"
              className="hub-btn hub-btn--secondary"
              onClick={() => void handleResetFlags()}
            >
              Reset all experiments
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
