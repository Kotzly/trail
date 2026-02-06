import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import type {
  LayoutSettings,
  MindmapLayoutSettings,
  RadialLayoutSettings,
  Settings,
  TreeLayoutSettings,
} from '../../../shared/types/settings.js';
import type { Url } from '../../../shared/types/ids.js';
import { getBackendConfig, initBackendConfig } from '../../../shared/config/backend.js';
import { DEFAULT_LAYOUT_SETTINGS } from '../../../shared/layout/defaults.js';
import { getAccountSnapshot, logout, normalizeAccountError } from '../../api/account.js';
import { saveSettings } from '../../api/settings.js';
import { getRangePercent } from '../shared/range.js';
import { resetNodeLayouts } from '../../api/tree.js';
import { applyTheme } from '../shared/apply-theme.js';
import { useStore } from '../state/store.js';
import { useOverlayEffects } from '../state/overlay-effects.js';
import { Icons } from './Icon.js';
import { Sidebar, SidebarBody, useSidebar } from './ui/sidebar';
import { useAuthPortalFlow } from '../hooks/useAuthPortalFlow.js';
import { createPortal } from 'react-dom';
import React from 'react';

type SettingsSectionId = 'preferences' | 'account' | 'about';
type PreferencesTabId = 'appearance' | 'display' | 'layout' | 'advanced';

type SettingsMenuItem = {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
};

type PreferencesTabItem = {
  id: PreferencesTabId;
  label: string;
  description: string;
  icon: LucideIcon;
};

type LayoutMode = Settings['layout']['mode'];

type StatusTone = 'good' | 'warn' | 'bad' | 'neutral';

const SETTINGS_SECTIONS: SettingsMenuItem[] = [
  {
    id: 'preferences',
    label: 'Preferences',
    description: 'Personalize the workspace',
    icon: Icons.SlidersHorizontal,
  },
  {
    id: 'account',
    label: 'Account',
    description: 'Sign in and web settings',
    icon: Icons.User,
  },
  {
    id: 'about',
    label: 'About',
    description: 'Build and runtime',
    icon: Icons.Info,
  },
];

const PREFERENCE_TABS: PreferencesTabItem[] = [
  {
    id: 'layout',
    label: 'Layout',
    description: 'Structure and spacing',
    icon: Icons.Network,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Theme and typography',
    icon: Icons.Sparkles,
  },
  {
    id: 'display',
    label: 'Display',
    description: 'Node details and signals',
    icon: Icons.List,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Limits and behavior',
    icon: Icons.Zap,
  },
];

const LAYOUT_OPTIONS: Array<{ id: LayoutMode; label: string; description: string; icon: LucideIcon }> = [
  {
    id: 'mindmap',
    label: 'Mindmap',
    description: 'Best for exploratory branches.',
    icon: Icons.BrainCircuit,
  },
  {
    id: 'tree',
    label: 'Tree',
    description: 'Best for long journeys.',
    icon: Icons.Network,
  },
  {
    id: 'radial',
    label: 'Radial',
    description: 'Best for dense clusters.',
    icon: Icons.Radius,
  },
];

const LAYOUT_LABELS: Record<LayoutMode, string> = {
  mindmap: 'Mindmap',
  tree: 'Tree',
  radial: 'Radial',
};

const LAYOUT_HINTS: Record<LayoutMode, string> = {
  mindmap: 'Split and explore in parallel.',
  tree: 'Follow long, linear journeys.',
  radial: 'Compact view for many branches.',
};

const THEME_OPTIONS: Array<{ id: Settings['theme']; label: string; icon: LucideIcon }> = [
  {
    id: 'system',
    label: 'System',
    icon: Icons.Laptop2,
  },
  {
    id: 'light',
    label: 'Light',
    icon: Icons.Sun,
  },
  {
    id: 'dark',
    label: 'Dark',
    icon: Icons.MoonStar,
  },
];

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;

type DragNumberInputProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  className?: string;
  onValueChange: (value: number) => void;
  onValueCommit?: (value: number) => void;
};

function RangeSlider({
  value,
  min,
  max,
  step,
  onValueChange,
  onValueCommit,
  label,
  valueLabel,
}: DragNumberInputProps & { label: string; valueLabel?: string }) {
  const formattedValue =
    valueLabel ??
    (step < 1
      ? Number.isFinite(value)
        ? value.toFixed(2)
        : '0'
      : String(Math.round(value)));
  const percent = getRangePercent(value, min, max);
  const rangeStyle = {
    ['--range-percent' as string]: `${Math.min(100, Math.max(0, percent))}%`,
  } as CSSProperties;
  return (
    <div className="popover-slider">
      <div className="popover-slider-header">
        <span className="popover-label-small">{label}</span>
        <span className="popover-slider-value">{formattedValue}</span>
      </div>
      <input
        type="range"
        className="popover-range"
        value={value}
        min={min}
        max={max}
        step={step}
        style={rangeStyle}
        onChange={(event) => {
          const next = clamp(Number(event.target.value), min, max);
          onValueChange(next);
        }}
        onPointerUp={(event) => {
          if (!onValueCommit) return;
          const next = clamp(Number(event.currentTarget.value), min, max);
          onValueCommit(next);
        }}
        onKeyUp={(event) => {
          if (!onValueCommit) return;
          const next = clamp(Number((event.currentTarget as HTMLInputElement).value), min, max);
          onValueCommit(next);
        }}
      />
    </div>
  );
}

type ToggleRowProps = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

function ToggleRow({ id, label, description, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <label className={`settings-toggle-row ${disabled ? 'disabled' : ''}`} htmlFor={id}>
      <div className="settings-toggle-text">
        <div className="settings-toggle-title">{label}</div>
        {description ? <div className="settings-toggle-description">{description}</div> : null}
      </div>
      <div className="settings-toggle-switch">
        <input
          id={id}
          className="settings-toggle-input"
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
        />
        <span className="settings-toggle-control" aria-hidden="true" />
      </div>
    </label>
  );
}

function formatTimestamp(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

type SettingsSidebarNavProps = {
  activeSection: SettingsSectionId;
  onSelectSection: (section: SettingsSectionId) => void;
};

type SettingsSidebarBodyProps = {
  children: React.ReactNode;
};

function SettingsSidebarBody({ children }: SettingsSidebarBodyProps) {
  const { open } = useSidebar();
  const stateClass = open ? 'is-open' : 'is-collapsed';

  return (
    <SidebarBody className={`settings-sidebar ${stateClass}`} showMobile={false} forceDesktop>
      {children}
    </SidebarBody>
  );
}

function SettingsSidebarNav({ activeSection, onSelectSection }: SettingsSidebarNavProps) {
  const { open, setOpen } = useSidebar();

  return (
    <nav className="settings-sidebar-nav" aria-label="Settings sections" data-open={open}>
      {SETTINGS_SECTIONS.map((section) => {
        const Icon = section.icon;
        const active = section.id === activeSection;
        return (
          <button
            key={section.id}
            type="button"
            className={`settings-nav-item ${active ? 'active' : ''}`}
            onMouseEnter={() => {
              if (!open) {
                setOpen(true);
              }
            }}
            onClick={() => onSelectSection(section.id)}
            aria-current={active ? 'page' : undefined}
          >
            <span className="settings-nav-icon">
              <Icon size={16} />
            </span>
            <span className="settings-nav-text">
              <span className="settings-nav-title">{section.label}</span>
              <span className="settings-nav-subtitle">{section.description}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export default function SettingsPopover() {
  const settingsOpen = useStore((state) => state.ui.settingsOpen);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const setThemePickerOpen = useStore((state) => state.setThemePickerOpen);
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);
  const requestGraphReset = useStore((state) => state.requestGraphReset);
  const account = useStore((state) => state.account);
  const setAccount = useStore((state) => state.setAccount);
  const setAccountSnapshot = useStore((state) => state.setAccountSnapshot);

  useOverlayEffects(settingsOpen, { lod: true, blur: true, kind: 'modal' });

  const [activeSection, setActiveSection] = useState<SettingsSectionId>('preferences');
  const [activePreferencesTab, setActivePreferencesTab] = useState<PreferencesTabId>('layout');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { busy: authFlowBusy, notice: authNotice, startAuthFlow, cancelAuthFlow, setNotice: setAuthNotice } =
    useAuthPortalFlow();
  const [authActionBusy, setAuthActionBusy] = useState(false);
  const authBusy = authFlowBusy || authActionBusy;
  const [portalBusy, setPortalBusy] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<Settings | null>(null);

  const layout = settings?.layout ?? DEFAULT_LAYOUT_SETTINGS;
  const defaultCapacityMax = 5000;
  const tabLimitMax = Math.max(50, settings?.maxOpenTabs ?? 0);
  const rawCapacity = settings?.capacity;
  const capacityValue = Number.isFinite(rawCapacity) ? (rawCapacity as number) : 0;
  const [capacityMax, setCapacityMax] = useState<number>(() => {
    if (!Number.isFinite(rawCapacity)) return defaultCapacityMax;
    return Math.max(500, rawCapacity as number, defaultCapacityMax);
  });
  const [tabLimitDraft, setTabLimitDraft] = useState<number>(settings?.maxOpenTabs ?? 0);
  const [capacityDraft, setCapacityDraft] = useState<number>(capacityValue);

  const isAuthenticated = account.session.status === 'authenticated' && Boolean(account.user);
  const accountStatusLabel = (() => {
    if (account.status === 'loading') return 'Syncing';
    if (account.status === 'error') return 'Needs attention';
    return isAuthenticated ? 'Connected' : 'Guest';
  })();
  const accountTone: StatusTone = (() => {
    if (account.status === 'error') return 'bad';
    if (account.status === 'loading' || account.network === 'offline') return 'warn';
    return isAuthenticated ? 'good' : 'neutral';
  })();

  useEffect(() => {
    if (!settingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSettingsOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [setSettingsOpen, settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) {
      cancelAuthFlow();
      setAuthActionBusy(false);
      setPortalBusy(false);
      return;
    }
    setAuthNotice(null);
    setAuthActionBusy(false);
    setPortalBusy(false);
    setActiveSection('preferences');
    setActivePreferencesTab('layout');
  }, [cancelAuthFlow, setAuthNotice, settingsOpen]);

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const toSave = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (!toSave) return;
    try {
      await saveSettings(toSave);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, []);

  const scheduleSave = useCallback(
    (next: Settings) => {
      pendingSaveRef.current = next;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void flushPendingSave();
      }, 400);
    },
    [flushPendingSave]
  );

  useEffect(() => {
    if (!settingsOpen) {
      void flushPendingSave();
    }
  }, [flushPendingSave, settingsOpen]);

  useEffect(() => () => {
    void flushPendingSave();
  }, [flushPendingSave]);

  useEffect(() => {
    setTabLimitDraft(settings?.maxOpenTabs ?? 0);
  }, [settings?.maxOpenTabs]);

  useEffect(() => {
    setCapacityDraft(capacityValue);
  }, [capacityValue]);

  useEffect(() => {
    setCapacityMax((prev) => {
      if (!Number.isFinite(rawCapacity)) return Math.max(prev, defaultCapacityMax);
      return Math.max(prev, rawCapacity as number, defaultCapacityMax, 500);
    });
  }, [rawCapacity]);

  const updateSettings = async (partial: Partial<Settings>) => {
    if (!settings) return;
    const next = { ...settings, ...partial };
    setSettings(next);
    if (partial.theme !== undefined || partial.customTheme !== undefined) {
      applyTheme(next.theme, next.customTheme);
    }
    scheduleSave(next);
  };

  type LayoutPatch = {
    mode?: LayoutSettings['mode'];
    tree?: Partial<TreeLayoutSettings>;
    mindmap?: Partial<MindmapLayoutSettings>;
    radial?: Partial<RadialLayoutSettings>;
  };

  const updateLayout = (partial: LayoutPatch) => {
    const next: LayoutSettings = {
      ...layout,
      ...partial,
      tree: { ...layout.tree, ...(partial.tree ?? {}) },
      mindmap: { ...layout.mindmap, ...(partial.mindmap ?? {}) },
      radial: { ...layout.radial, ...(partial.radial ?? {}) },
    };
    void updateSettings({ layout: next });
  };

  const resetLayout = () => {
    void updateSettings({
      layout: {
        mode: layout.mode,
        tree: { ...DEFAULT_LAYOUT_SETTINGS.tree },
        mindmap: { ...DEFAULT_LAYOUT_SETTINGS.mindmap },
        radial: { ...DEFAULT_LAYOUT_SETTINGS.radial },
      },
    });
  };

  const resetView = async () => {
    void updateSettings({
      layout: {
        mode: layout.mode,
        tree: { ...DEFAULT_LAYOUT_SETTINGS.tree },
        mindmap: { ...DEFAULT_LAYOUT_SETTINGS.mindmap },
        radial: { ...DEFAULT_LAYOUT_SETTINGS.radial },
      },
    });
    try {
      await resetNodeLayouts();
    } catch (error) {
      console.error('Failed to reset node layouts:', error);
    }
    requestGraphReset();
  };

  const syncAccountSnapshot = useCallback(async () => {
    setAccount({ status: 'loading', error: null });
    const snapshot = await getAccountSnapshot();
    setAccountSnapshot(snapshot);
  }, [setAccount, setAccountSnapshot]);

  const openExternalLink = async (url: Url) => {
    try {
      await chrome.tabs.create({ url, active: true });
    } catch (error) {
      console.error('Failed to open external link:', error);
      window?.open(url, '_blank');
    }
  };

  const handleSignIn = async () => {
    if (authBusy) return;
    await startAuthFlow({ source: 'extension' });
  };

  const handleLogout = async () => {
    if (authActionBusy) return;
    setAuthActionBusy(true);
    setAuthNotice(null);
    setAccount({ status: 'loading', error: null });
    try {
      await logout();
      await syncAccountSnapshot();
    } catch (error) {
      const normalized = normalizeAccountError(error);
      setAccount({ status: 'error', error: normalized, network: normalized.code === 'network' ? 'offline' : 'online' });
    } finally {
      setAuthActionBusy(false);
    }
  };

  const handleRefreshAccount = async () => {
    setPortalBusy(true);
    try {
      await syncAccountSnapshot();
    } catch (error) {
      const normalized = normalizeAccountError(error);
      setAccount({ status: 'error', error: normalized, network: normalized.code === 'network' ? 'offline' : 'online' });
    } finally {
      setPortalBusy(false);
    }
  };

  const handleOpenAccountSettings = async () => {
    if (portalBusy) return;
    setPortalBusy(true);
    try {
      await initBackendConfig();
      await openExternalLink(getBackendConfig().portalUrl as Url);
    } finally {
      setPortalBusy(false);
    }
  };

  if (!settingsOpen) return null;
  if (typeof document === 'undefined') return null;

  const networkBadge =
    account.network === 'offline' ? (
      <div className="settings-banner warn">
        <Icons.AlertTriangle size={14} />
        <span>Offline mode. Account data may be stale.</span>
      </div>
    ) : null;

  const accountError = account.error ? (
    <div className="settings-banner error">
      <Icons.XCircle size={14} />
      <span>{account.error.message}</span>
    </div>
  ) : null;

  const renderPreferences = () => (
    <div className="settings-panel-scroll">
      <div className="settings-panel-head">
        <div className="settings-panel-title">Preferences</div>
        <div className="settings-panel-subtitle">Make Trail feel like your own space.</div>
      </div>

      <div className="settings-tablist settings-card-shell" role="tablist" aria-label="Preferences tabs">
        {PREFERENCE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activePreferencesTab;
          return (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              type="button"
              role="tab"
              title={`${tab.label} — ${tab.description}`}
              className={`settings-tab-btn ${active ? 'active' : ''}`}
              aria-selected={active}
              aria-controls={`settings-tabpanel-${tab.id}`}
              onClick={() => setActivePreferencesTab(tab.id)}
            >
              <span className="settings-tab-icon">
                <Icon size={16} />
              </span>
              <span className="settings-tab-text">
                <span className="settings-tab-title">{tab.label}</span>
                <span className="settings-tab-desc">{tab.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="settings-tab-panel"
        role="tabpanel"
        id={`settings-tabpanel-${activePreferencesTab}`}
        aria-labelledby={`settings-tab-${activePreferencesTab}`}
      >
        {(() => {
          switch (activePreferencesTab) {
            case 'appearance':
              return (
                <>
                  <div className="settings-section">
                    <div className="settings-section-header">
                      <div className="settings-section-title">Theme</div>
                      <div className="settings-section-hint">Choose a mode, then fine tune colors.</div>
                    </div>
                    <div className="popover-section">
                      <div className="settings-row">
                        <span className="popover-hint">
                          Open Theme Studio for custom palettes and textures.
                        </span>
                        <button
                          className="settings-secondary-btn"
                          type="button"
                          onClick={() => setThemePickerOpen(true)}
                        >
                          Theme Studio
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-header">
                      <div className="settings-section-title">Typography</div>
                      <div className="settings-section-hint">Control density and truncation.</div>
                    </div>

                    <div className="popover-section">
                      <div className="popover-label-small">Graph density</div>
                      <div className="popover-segment">
                        <button
                          type="button"
                          className={`popover-segment-btn wide ${settings?.graphDensity === 'compact' ? 'active' : ''}`}
                          onClick={() => updateSettings({ graphDensity: 'compact' })}
                        >
                          Compact
                        </button>
                        <button
                          type="button"
                          className={`popover-segment-btn wide ${settings?.graphDensity === 'comfortable' ? 'active' : ''}`}
                          onClick={() => updateSettings({ graphDensity: 'comfortable' })}
                        >
                          Comfortable
                        </button>
                        <button
                          type="button"
                          className={`popover-segment-btn wide ${settings?.graphDensity === 'spacious' ? 'active' : ''}`}
                          onClick={() => updateSettings({ graphDensity: 'spacious' })}
                        >
                          Spacious
                        </button>
                      </div>
                      <div className="popover-hint">Scale node size and spacing.</div>
                    </div>

                    <div className="popover-section">
                      <div className="popover-label-small">Title truncation</div>
                      <div className="popover-segment">
                        <button
                          type="button"
                          className={`popover-segment-btn wide ${settings?.titleTruncation === 'start' ? 'active' : ''}`}
                          onClick={() => updateSettings({ titleTruncation: 'start' })}
                        >
                          Start
                        </button>
                        <button
                          type="button"
                          className={`popover-segment-btn wide ${settings?.titleTruncation === 'middle' ? 'active' : ''}`}
                          onClick={() => updateSettings({ titleTruncation: 'middle' })}
                        >
                          Middle
                        </button>
                        <button
                          type="button"
                          className={`popover-segment-btn wide ${settings?.titleTruncation === 'end' ? 'active' : ''}`}
                          onClick={() => updateSettings({ titleTruncation: 'end' })}
                        >
                          End
                        </button>
                      </div>
                      <div className="popover-hint">Where long titles are shortened.</div>
                    </div>
                  </div>
                </>
              );
            case 'display':
              return (
                <div className="settings-section">
                  <div className="settings-section-header">
                    <div className="settings-section-title">Graph display</div>
                    <div className="settings-section-hint">Control what appears on each node.</div>
                  </div>
                  <div className="settings-toggle-grid">
                    <ToggleRow
                      id="pref-favicons"
                      label="Show favicons"
                      description="Display site icons on nodes."
                      checked={settings?.showFavicons ?? true}
                      onChange={(value) => updateSettings({ showFavicons: value })}
                    />
                    <ToggleRow
                      id="pref-urls"
                      label="Show URLs"
                      description="Reveal the destination line under titles."
                      checked={settings?.showUrls ?? true}
                      onChange={(value) => updateSettings({ showUrls: value })}
                    />
                    <ToggleRow
                      id="pref-tags"
                      label="Show tag dots"
                      description="Surface tag colors on nodes."
                      checked={settings?.showTagDots ?? true}
                      onChange={(value) => updateSettings({ showTagDots: value })}
                    />
                    <ToggleRow
                      id="pref-tab-counts"
                      label="Show tab counts"
                      description="Badge nodes with open tab counts."
                      checked={settings?.showTabCounts ?? true}
                      onChange={(value) => updateSettings({ showTabCounts: value })}
                    />
                    <ToggleRow
                      id="pref-audio"
                      label="Show audio indicators"
                      description="Surface muted and audible tabs."
                      checked={settings?.showAudioIndicators ?? true}
                      onChange={(value) => updateSettings({ showAudioIndicators: value })}
                    />
                    <ToggleRow
                      id="pref-connections"
                      label="Show connections"
                      description="Draw branch lines between nodes."
                      checked={settings?.showConnections ?? true}
                      onChange={(value) => updateSettings({ showConnections: value })}
                    />
                    <ToggleRow
                      id="pref-dim-closed"
                      label="Dim closed nodes"
                      description="Fade nodes with no open tabs."
                      checked={settings?.dimClosedNodes ?? true}
                      onChange={(value) => updateSettings({ dimClosedNodes: value })}
                    />
                  </div>
                </div>
              );
            case 'layout':
              return (
                <>
                  <div className="settings-section">
                    <div className="settings-layout-panel settings-card-shell">
                      <div className="settings-section-header">
                        <div className="settings-section-title">Layout mode</div>
                        <div className="settings-section-hint">Pick a structure that matches how you browse.</div>
                      </div>
                      <div className="settings-choice-grid">
                        {LAYOUT_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          const active = layout.mode === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={`settings-choice ${active ? 'active' : ''}`}
                              aria-pressed={active}
                              onClick={() => updateLayout({ mode: option.id })}
                            >
                              <span className="settings-choice-icon">
                                <Icon size={16} />
                              </span>
                              <span className="settings-choice-text">
                                <span className="settings-choice-title">{option.label}</span>
                                <span className="settings-choice-hint">{option.description}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-header">
                      <div className="settings-section-title">{LAYOUT_LABELS[layout.mode]} tuning</div>
                      <div className="settings-section-hint">{LAYOUT_HINTS[layout.mode]}</div>
                    </div>
                    <div className="popover-section">
                      {layout.mode === 'tree' ? (
                        <>
                          <RangeSlider
                            label="Vertical gap"
                            value={layout.tree.verticalGapScale}
                            min={0.4}
                            max={3}
                            step={0.05}
                            onValueChange={(value) => updateLayout({ tree: { verticalGapScale: value } })}
                          />
                          <RangeSlider
                            label="Horizontal gap"
                            value={layout.tree.horizontalGapScale}
                            min={0.4}
                            max={3}
                            step={0.05}
                            onValueChange={(value) => updateLayout({ tree: { horizontalGapScale: value } })}
                          />
                          <ToggleRow
                            id="setting-tree-hide-root"
                            label="Hide root"
                            description="Hide the root placeholder node and its links."
                            checked={layout.tree.hideRoot}
                            onChange={(next) => updateLayout({ tree: { hideRoot: next } })}
                          />
                        </>
                      ) : layout.mode === 'mindmap' ? (
                        <>
                          <RangeSlider
                            label="Vertical gap"
                            value={layout.mindmap.verticalGapScale}
                            min={0.4}
                            max={3}
                            step={0.05}
                            onValueChange={(value) => updateLayout({ mindmap: { verticalGapScale: value } })}
                          />
                          <RangeSlider
                            label="Horizontal gap"
                            value={layout.mindmap.horizontalGapScale}
                            min={0.4}
                            max={3}
                            step={0.05}
                            onValueChange={(value) => updateLayout({ mindmap: { horizontalGapScale: value } })}
                          />
                        </>
                      ) : (
                        <>
                          <RangeSlider
                            label="Angle weight"
                            value={layout.radial.angleWeightExp}
                            min={0.2}
                            max={1.2}
                            step={0.01}
                            onValueChange={(value) => updateLayout({ radial: { angleWeightExp: value } })}
                          />
                          <RangeSlider
                            label="Min span factor"
                            value={layout.radial.minSpanFactor}
                            min={0.4}
                            max={0.95}
                            step={0.01}
                            onValueChange={(value) => updateLayout({ radial: { minSpanFactor: value } })}
                          />
                          <RangeSlider
                            label="Min span (rad)"
                            value={layout.radial.minSpanAbs}
                            min={0.04}
                            max={0.5}
                            step={0.01}
                            onValueChange={(value) => updateLayout({ radial: { minSpanAbs: value } })}
                          />
                          <RangeSlider
                            label="Required scale"
                            value={layout.radial.requiredScale}
                            min={0.35}
                            max={1.2}
                            step={0.05}
                            onValueChange={(value) => updateLayout({ radial: { requiredScale: value } })}
                          />
                          <RangeSlider
                            label="Depth gap"
                            value={layout.radial.depthGapBase}
                            min={0.6}
                            max={2.5}
                            step={0.05}
                            onValueChange={(value) => updateLayout({ radial: { depthGapBase: value } })}
                          />
                          <RangeSlider
                            label="Gap growth"
                            value={layout.radial.depthGapGrowth}
                            min={0}
                            max={0.8}
                            step={0.02}
                            onValueChange={(value) => updateLayout({ radial: { depthGapGrowth: value } })}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-header">
                      <div className="settings-section-title">Reset layout</div>
                      <div className="settings-section-hint">Restore defaults or reset the view entirely.</div>
                    </div>
                    <div className="settings-action-row">
                      <button type="button" className="settings-secondary-btn" onClick={resetLayout}>
                        Reset layout defaults
                      </button>
                      <button type="button" className="settings-secondary-btn" onClick={resetView}>
                        Reset view (factory)
                      </button>
                    </div>
                  </div>
                </>
              );
            case 'advanced':
              return (
                <>
                  <div className="settings-section">
                    <div className="settings-section-header">
                      <div className="settings-section-title">Behavior</div>
                      <div className="settings-section-hint">Confirmations and power controls.</div>
                    </div>
                    <div className="settings-toggle-grid">
                      <ToggleRow
                        id="pref-confirm"
                        label="Confirm new tree"
                        description="Ask before creating a fresh tree."
                        checked={settings?.confirmNewTree ?? true}
                        onChange={(value) => updateSettings({ confirmNewTree: value })}
                      />
                      <ToggleRow
                        id="pref-shortcuts"
                        label="Keyboard shortcuts"
                        description="Use global shortcuts inside the panel."
                        checked={settings?.shortcutsEnabled ?? true}
                        onChange={(value) => updateSettings({ shortcutsEnabled: value })}
                      />
                    </div>
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-header">
                      <div className="settings-section-title">Limits</div>
                      <div className="settings-section-hint">Control storage and active tabs.</div>
                    </div>
                    <div className="popover-section">
                      <RangeSlider
                        label="Tab limit"
                        value={tabLimitDraft}
                        min={0}
                        max={tabLimitMax}
                        step={1}
                        valueLabel={tabLimitDraft === 0 ? '∞' : String(tabLimitDraft)}
                        onValueChange={(value) => {
                          const maxOpenTabs = Number.isFinite(value) && value >= 0 ? value : 0;
                          setTabLimitDraft(maxOpenTabs);
                        }}
                        onValueCommit={(value) => {
                          const maxOpenTabs = Number.isFinite(value) && value >= 0 ? value : 0;
                          void updateSettings({ maxOpenTabs });
                        }}
                      />
                    </div>

                    <div className="popover-section">
                      <RangeSlider
                        label="Tree capacity"
                        value={capacityDraft}
                        min={0}
                        max={capacityMax}
                        step={50}
                        valueLabel={capacityDraft === 0 ? '∞' : String(Math.round(capacityDraft))}
                        onValueChange={(value) => {
                          const capacity = value <= 0 ? Infinity : Math.max(1, Math.round(value));
                          setCapacityDraft(capacity === Infinity ? 0 : capacity);
                        }}
                        onValueCommit={(value) => {
                          const capacity = value <= 0 ? Infinity : Math.max(1, Math.round(value));
                          void updateSettings({ capacity });
                        }}
                      />
                      <div className="popover-hint">Pinned nodes are never evicted.</div>
                    </div>
                  </div>

                  
                </>
              );
            default:
              return null;
          }
        })()}
      </div>
    </div>
  );

  const renderAccount = () => (
    <div className="settings-panel-scroll">
      <div className="settings-panel-head">
        <div className="settings-panel-title">Account</div>
        <div className="settings-panel-subtitle">
          Sign in once, then manage privacy and subscriptions on the web.
        </div>
      </div>
      {networkBadge}
      {accountError}

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-card-title">Status</div>
            <div className="settings-card-hint">
              {isAuthenticated
                ? 'Signed in and ready to sync.'
                : 'Connect a Trail account to sync preferences.'}
            </div>
          </div>
          <span className="status-pill" data-tone={accountTone}>
            {accountStatusLabel}
          </span>
        </div>

        {isAuthenticated && account.user ? (
          <div className="account-profile">
            <div className="account-avatar">
              {account.user.avatarUrl ? (
                <img
                  src={account.user.avatarUrl}
                  alt={`${account.user.displayName ?? account.user.email} avatar`}
                />
              ) : (
                <span>{account.user.displayName?.slice(0, 1).toUpperCase() ?? 'U'}</span>
              )}
            </div>
            <div className="account-meta">
              <div className="account-name">{account.user.displayName || account.user.email}</div>
              <div className="account-email">{account.user.email}</div>
            </div>
          </div>
        ) : (
          <div className="settings-card-hint">You are browsing as a guest.</div>
        )}

        <div className="settings-stat-grid">
          <div>
            <div className="settings-stat-label">Last sync</div>
            <div className="settings-stat-value">{formatTimestamp(account.lastSyncedAt)}</div>
          </div>
          <div>
            <div className="settings-stat-label">Network</div>
            <div className="settings-stat-value">{account.network}</div>
          </div>
        </div>

        <div className="settings-row">
          {isAuthenticated ? (
            <button className="settings-secondary-btn" type="button" onClick={handleLogout} disabled={authBusy}>
              {authBusy ? 'Signing out…' : 'Sign out'}
            </button>
          ) : (
            <button className="settings-primary-btn" type="button" onClick={() => void handleSignIn()} disabled={authBusy}>
              {authBusy ? 'Opening…' : 'Sign in'}
            </button>
          )}
          <button
            className="settings-secondary-btn"
            type="button"
            onClick={() => void handleRefreshAccount()}
            disabled={portalBusy}
          >
            {portalBusy ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {authNotice ? <div className="settings-card-hint">{authNotice}</div> : null}
      </div>

      <div className="settings-card subtle">
        <div className="settings-card-title">Account settings</div>
        <div className="settings-card-hint">
          Privacy, data retention, and subscriptions are managed in your Trail account.
        </div>
        <button
          className="settings-secondary-btn"
          type="button"
          onClick={() => void handleOpenAccountSettings()}
          disabled={portalBusy}
        >
          Open account settings
        </button>
      </div>
    </div>
  );

  const renderAbout = () => {
    const version =
      typeof chrome !== 'undefined' && chrome.runtime?.getManifest
        ? chrome.runtime.getManifest().version
        : 'dev';
    return (
      <div className="settings-panel-scroll">
        <div className="settings-panel-head">
          <div className="settings-panel-title">About</div>
          <div className="settings-panel-subtitle">Trail for sidepanel.</div>
        </div>
        <div className="settings-card">
          <div className="settings-card-title">Build</div>
          <div className="settings-stat-grid">
            <div>
              <div className="settings-stat-label">Version</div>
              <div className="settings-stat-value">{version}</div>
            </div>
            <div>
              <div className="settings-stat-label">Channel</div>
              <div className="settings-stat-value">Local</div>
            </div>
            <div>
              <div className="settings-stat-label">Runtime</div>
              <div className="settings-stat-value">Chrome sidepanel</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPanel = () => {
    switch (activeSection) {
      case 'preferences':
        return renderPreferences();
      case 'account':
        return renderAccount();
      case 'about':
        return renderAbout();
      default:
        return renderPreferences();
    }
  };

  return createPortal(
    <div className="modal-overlay settings-modal-overlay lod-enabler blur-enabler" onClick={() => setSettingsOpen(false)}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        aria-describedby="settings-dialog-subtitle"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="settings-modal-header">
          <div className="settings-modal-heading">
            <div id="settings-dialog-title" className="settings-modal-title">Settings</div>
            <div id="settings-dialog-subtitle" className="settings-modal-subtitle">
              Personalize Trail, from layouts to account sync.
            </div>
          </div>
          <button
            className="settings-close-btn"
            type="button"
            onClick={() => setSettingsOpen(false)}
            aria-label="Close settings"
          >
            <Icons.X size={18} />
          </button>
        </div>

        <div className="settings-modal-body">
          <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
            <SettingsSidebarBody>
            <SettingsSidebarNav
              activeSection={activeSection}
              onSelectSection={(section) => {
                setActiveSection(section);
              }}
            />
            </SettingsSidebarBody>
          </Sidebar>
          <div className="settings-panel">{renderPanel()}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
