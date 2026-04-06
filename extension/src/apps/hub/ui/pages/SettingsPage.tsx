import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
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
import { Switch } from "@ui/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@ui/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@ui/components/ui/card";
import { Button } from "@ui/components/ui/button";

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
    <Tabs value={value} onValueChange={(v) => onChange(v as T)}>
      <TabsList className="h-7">
        {options.map((opt) => (
          <TabsTrigger key={opt} value={opt} className="text-xs px-3 h-6">
            {opt}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function SettingToggle({
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
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="flex flex-col gap-0.5 cursor-pointer">
        <span className="text-[13px] text-foreground">{label}</span>
        {description && (
          <span className="text-[11px] text-muted-foreground">{description}</span>
        )}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-3 rounded-lg py-4">
      <CardHeader className="px-4 py-0">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 flex flex-col gap-3">
        {children}
      </CardContent>
    </Card>
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
      <div className="flex flex-col gap-5 max-w-3xl">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <Card className="items-center gap-2 py-12 px-6 border-dashed text-center">
          <p className="text-[13px] text-muted-foreground">Loading...</p>
        </Card>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex flex-col gap-5 max-w-3xl">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <Card className="items-center gap-2 py-12 px-6 border-dashed text-center">
          <p className="text-[13px] text-muted-foreground max-w-[300px]">
            Could not load settings. Make sure the Trail extension is installed.
          </p>
        </Card>
      </div>
    );
  }

  const layout = settings.layout ?? DEFAULT_LAYOUT_SETTINGS;

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <h1 className="text-xl font-semibold tracking-tight" onClick={handleTitleClick}>
        Settings
      </h1>

      {authenticated && user && (
        <SettingsSection title="Account">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-muted-foreground">Email</span>
            <span className="text-[13px] text-foreground">{user.email ?? "—"}</span>
          </div>
        </SettingsSection>
      )}

      <SettingsSection title="Graph">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">Layout mode</span>
          <Seg
            value={layout.mode}
            options={["mindmap", "tree", "radial"] as const}
            onChange={(mode: LayoutMode) =>
              update({ layout: { ...layout, mode } })
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">Title truncation</span>
          <Seg
            value={settings.titleTruncation ?? "middle"}
            options={["start", "middle", "end"] as const}
            onChange={(v: TitleTruncation) => update({ titleTruncation: v })}
          />
        </div>

        <SettingToggle
          id="keep-tabs"
          label="Keep tabs on switch"
          description="Preserve open tabs when switching trees"
          checked={settings.keepTabsOnSwitch ?? true}
          onChange={(v) => update({ keepTabsOnSwitch: v })}
        />

        <SettingToggle
          id="show-connections"
          label="Show connections"
          checked={settings.showConnections ?? true}
          onChange={(v) => update({ showConnections: v })}
        />

        <SettingToggle
          id="show-favicons"
          label="Show favicons"
          checked={settings.showFavicons ?? true}
          onChange={(v) => update({ showFavicons: v })}
        />

        <SettingToggle
          id="dim-closed"
          label="Dim closed nodes"
          description="Reduce opacity of nodes without open tabs"
          checked={settings.dimClosedNodes ?? false}
          onChange={(v) => update({ dimClosedNodes: v })}
        />

        {layout.mode === "tree" && (
          <SettingToggle
            id="hide-root"
            label="Hide root paths"
            checked={layout.tree?.hideRoot ?? false}
            onChange={(v) =>
              update({ layout: { ...layout, tree: { ...layout.tree, hideRoot: v } } })
            }
          />
        )}
      </SettingsSection>

      <SettingsSection title="Appearance">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">Theme</span>
          <Seg
            value={settings.theme ?? "system"}
            options={["system", "light", "dark"] as const}
            onChange={(v) => update({ theme: v })}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Behavior">
        <SettingToggle
          id="shortcuts"
          label="Keyboard shortcuts"
          description="Enable keyboard shortcuts in the side panel"
          checked={settings.shortcutsEnabled ?? true}
          onChange={(v) => update({ shortcutsEnabled: v })}
        />

        <SettingToggle
          id="confirm-new-tree"
          label="Confirm new tree"
          description="Show confirmation before creating a new tree"
          checked={settings.confirmNewTree ?? false}
          onChange={(v) => update({ confirmNewTree: v })}
        />

        <SettingToggle
          id="adaptive-perf"
          label="Adaptive performance"
          description="Automatically reduce visual quality for large trees"
          checked={settings.adaptivePerformance ?? true}
          onChange={(v) => update({ adaptivePerformance: v })}
        />
      </SettingsSection>

      <SettingsSection title="Search">
        <SettingToggle
          id="search-suggestions"
          label="Search suggestions"
          description="Queries are sent to Google for suggestions"
          checked={suggestionsEnabled}
          onChange={(v) => {
            setSuggestionsEnabled(v);
            searchSuggestionsEnabledItem.setValue(v).catch(() => {});
          }}
        />
      </SettingsSection>

      {experimentsUnlocked && flags && (
        <SettingsSection title="Experiments">
          {(Object.keys(FLAG_DEFS) as FlagKey[]).map((key) => {
            const def = FLAG_DEFS[key];
            if (def.type === "boolean") {
              return (
                <SettingToggle
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
                <div key={key} className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-muted-foreground">{def.label}</span>
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleResetFlags()}
          >
            Reset all experiments
          </Button>
        </SettingsSection>
      )}
    </div>
  );
}
