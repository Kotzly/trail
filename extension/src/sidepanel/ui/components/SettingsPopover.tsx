import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import type {
  LayoutSettings,
  MindmapLayoutSettings,
  RadialLayoutSettings,
  Settings,
  TreeLayoutSettings,
} from '../../../shared/types/settings.js';
import type { PlanInterval } from '../../../shared/types/account.js';
import { BACKEND_CONFIG } from '../../../shared/config/backend.js';
import { DEFAULT_LAYOUT_SETTINGS } from '../../../shared/layout/defaults.js';
import {
  checkAuthPortal,
  createBillingPortalLink,
  getAccountSnapshot,
  logout,
  normalizeAccountError,
  startAuthPortal,
  startCheckout,
} from '../../api/account.js';
import { saveSettings } from '../../api/settings.js';
import { getRangePercent } from '../shared/range.js';
import { resetNodeLayouts } from '../../api/tree.js';
import { applyTheme } from '../shared/apply-theme.js';
import { useStore } from '../state/store.js';
import { Icons } from './Icon.js';
import { createPortal } from 'react-dom';
import React from 'react';

type SettingsSectionId = 'profile' | 'subscription' | 'preferences' | 'shortcuts' | 'privacy' | 'about';

type SettingsMenuItem = {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
};

const SETTINGS_SECTIONS: SettingsMenuItem[] = [
  {
    id: 'profile',
    label: 'Profile',
    description: 'Account and identity',
    icon: Icons.User,
  },
  {
    id: 'subscription',
    label: 'Subscription',
    description: 'Plans and billing',
    icon: Icons.CreditCard,
  },
  {
    id: 'preferences',
    label: 'Preferences',
    description: 'Look and behavior',
    icon: Icons.SlidersHorizontal,
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    description: 'Keyboard map',
    icon: Icons.Keyboard,
  },
  {
    id: 'privacy',
    label: 'Data & Privacy',
    description: 'Local storage',
    icon: Icons.Shield,
  },
  {
    id: 'about',
    label: 'About',
    description: 'Build info',
    icon: Icons.Info,
  },
];

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;

const sleep = (ms: number) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

const resolveDeadline = (expiresAt?: string | null): number => {
  if (!expiresAt) return Date.now() + 5 * 60 * 1000;
  const parsed = Date.parse(expiresAt);
  return Number.isNaN(parsed) ? Date.now() + 5 * 60 * 1000 : parsed;
};

const DEFAULT_ADAPTIVE_LAYOUTS: Settings['adaptiveModeLayouts'] = {
  mindmap: true,
  tree: true,
  radial: true,
};

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

type CheckboxRowProps = {
  id: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

function CheckboxRow({ id, label, checked, onChange, disabled }: CheckboxRowProps) {
  return (
    <label className={`settings-checkbox-row ${disabled ? 'disabled' : ''}`} htmlFor={id}>
      <input
        id={id}
        className="settings-checkbox-input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span className="settings-checkbox-label">{label}</span>
    </label>
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

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatPrice(amount: number, currency: string, interval: PlanInterval): string {
  if (amount === 0) return 'Free';
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted}/${interval === 'month' ? 'mo' : 'yr'}`;
}

function getBillingTone(state: string): 'good' | 'warn' | 'bad' | 'neutral' {
  if (state === 'ok' || state === 'trialing') return 'good';
  if (state === 'past_due' || state === 'grace') return 'warn';
  if (state === 'unpaid' || state === 'canceled') return 'bad';
  return 'neutral';
}

export default function SettingsPopover() {
  const settingsOpen = useStore((state) => state.ui.settingsOpen);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);
  const requestGraphReset = useStore((state) => state.requestGraphReset);
  const account = useStore((state) => state.account);
  const setAccount = useStore((state) => state.setAccount);
  const setAccountSnapshot = useStore((state) => state.setAccountSnapshot);
  const nodeCount = useStore((state) => state.nodeCount);
  const metaKey = useStore((state) => state.metaKey);

  const [activeSection, setActiveSection] = useState<SettingsSectionId>('preferences');
  const [authBusy, setAuthBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [subscriptionNotice, setSubscriptionNotice] = useState<string | null>(null);
  const [interval, setInterval] = useState<PlanInterval>('month');
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<Settings | null>(null);
  const authFlowRef = useRef(0);

  const layout = settings?.layout ?? DEFAULT_LAYOUT_SETTINGS;
  const layoutHints: Record<Settings['layout']['mode'], string> = {
    mindmap: 'best for short journeys',
    tree: 'best for long journeys',
    radial: 'best for many short journeys',
  };
  const layoutLabels: Record<Settings['layout']['mode'], string> = {
    mindmap: 'Mindmap',
    tree: 'Tree',
    radial: 'Radial',
  };
  const adaptiveLayouts = settings?.adaptiveModeLayouts ?? DEFAULT_ADAPTIVE_LAYOUTS;
  const adaptiveModeEnabled = settings?.adaptiveMode ?? false;
  const adaptiveSelectedCount = Object.values(adaptiveLayouts).filter(Boolean).length;
  const adaptiveLayoutOptions: Settings['layout']['mode'][] = ['mindmap', 'tree', 'radial'];
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

  const sortedPlans = useMemo(() => {
    const list = account.plans ?? [];
    return [...list].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  }, [account.plans]);
  const currentPlanId = account.subscription?.planId ?? 'free';
  const currentPlan = sortedPlans.find((plan) => plan.id === currentPlanId);
  const isAuthenticated = account.session.status === 'authenticated' && Boolean(account.user);

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
      authFlowRef.current += 1;
      setAuthBusy(false);
      setPortalBusy(false);
      return;
    }
    setAuthNotice(null);
    setSubscriptionNotice(null);
    setAuthBusy(false);
    setPortalBusy(false);
    setActiveSection('preferences');
  }, [settingsOpen]);

  useEffect(() => {
    if (!account.subscription?.interval) return;
    setInterval(account.subscription.interval);
  }, [account.subscription?.interval]);

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

  const scheduleSave = useCallback((next: Settings) => {
    pendingSaveRef.current = next;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void flushPendingSave();
    }, 400);
  }, [flushPendingSave]);

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
    applyTheme(next.theme, next.customTheme);
    scheduleSave(next);
  };

  const updateAdaptiveLayouts = (mode: Settings['layout']['mode'], enabled: boolean) => {
    if (!settings) return;
    const isOnlySelected = adaptiveSelectedCount <= 1 && adaptiveLayouts[mode];
    if (!enabled && isOnlySelected) return;
    const nextLayouts = { ...adaptiveLayouts, [mode]: enabled };
    void updateSettings({ adaptiveModeLayouts: nextLayouts });
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

  const openExternalLink = async (url: string) => {
    try {
      await chrome.tabs.create({ url, active: true });
    } catch (error) {
      console.error('Failed to open external link:', error);
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
    }
  };

  const handleSignIn = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthNotice(null);
    setAccount({ status: 'loading', error: null });
    authFlowRef.current += 1;
    const flowId = authFlowRef.current;
    try {
      const portalSession = await startAuthPortal({
        source: 'extension',
        locale: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
        returnUrl: BACKEND_CONFIG.portalUrl,
      });
      await openExternalLink(portalSession.url);
      setAuthNotice('Complete sign-in in the opened tab. Waiting for confirmation…');
      const deadline = resolveDeadline(portalSession.expiresAt);
      const pollInterval = portalSession.pollIntervalMs ?? 3000;
      while (authFlowRef.current === flowId) {
        if (Date.now() > deadline) {
          setAuthNotice('Sign-in link expired. Please try again.');
          setAccount({ status: 'ready', error: null });
          break;
        }
        await sleep(pollInterval);
        const status = await checkAuthPortal(portalSession.id);
        if (authFlowRef.current !== flowId) return;
        if (status.status === 'approved') {
          if (status.snapshot) {
            setAccountSnapshot(status.snapshot);
          } else {
            await syncAccountSnapshot();
          }
          setAuthNotice(null);
          return;
        }
        if (status.status === 'expired') {
          setAuthNotice('Sign-in link expired. Please try again.');
          setAccount({ status: 'ready', error: null });
          return;
        }
      }
    } catch (error) {
      const normalized = normalizeAccountError(error);
      setAccount({ status: 'error', error: normalized, network: normalized.code === 'network' ? 'offline' : 'online' });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setAuthBusy(true);
    setAuthNotice(null);
    setAccount({ status: 'loading', error: null });
    authFlowRef.current += 1;
    try {
      await logout();
      await syncAccountSnapshot();
    } catch (error) {
      const normalized = normalizeAccountError(error);
      setAccount({ status: 'error', error: normalized, network: normalized.code === 'network' ? 'offline' : 'online' });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCheckout = async (planId: string) => {
    if (!isAuthenticated) return;
    setPortalBusy(true);
    setSubscriptionNotice(null);
    setAccount({ status: 'loading', error: null });
    try {
      const portal = await startCheckout({ planId, interval });
      await openExternalLink(portal.url);
      setSubscriptionNotice('Checkout opened. Complete payment, then refresh to sync.');
    } catch (error) {
      const normalized = normalizeAccountError(error);
      setAccount({ status: 'error', error: normalized, network: normalized.code === 'network' ? 'offline' : 'online' });
    } finally {
      setPortalBusy(false);
    }
  };

  const handleBillingPortal = async () => {
    if (!isAuthenticated) return;
    setPortalBusy(true);
    setSubscriptionNotice(null);
    setAccount({ status: 'loading', error: null });
    try {
      const portal = await createBillingPortalLink();
      await openExternalLink(portal.url);
      setSubscriptionNotice('Billing portal opened. Return here and refresh to sync changes.');
    } catch (error) {
      const normalized = normalizeAccountError(error);
      setAccount({ status: 'error', error: normalized, network: normalized.code === 'network' ? 'offline' : 'online' });
    } finally {
      setPortalBusy(false);
    }
  };

  const handleRefreshAccount = async () => {
    setPortalBusy(true);
    setSubscriptionNotice(null);
    try {
      await syncAccountSnapshot();
    } catch (error) {
      const normalized = normalizeAccountError(error);
      setAccount({ status: 'error', error: normalized, network: normalized.code === 'network' ? 'offline' : 'online' });
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

  const renderProfile = () => (
    <div className="settings-panel-scroll">
      <div className="settings-panel-title">Profile</div>
      <div className="settings-panel-subtitle">Manage your account identity and sign-in state.</div>
      {networkBadge}
      {accountError}
      {isAuthenticated && account.user ? (
        <div className="settings-card">
          <div className="profile-row">
            <div className="profile-avatar">
              {account.user.avatarUrl ? (
                <img
                  src={account.user.avatarUrl}
                  alt={`${account.user.displayName ?? account.user.email} avatar`}
                />
              ) : (
                <span>{account.user.displayName?.slice(0, 1).toUpperCase() ?? 'U'}</span>
              )}
            </div>
            <div className="profile-meta">
              <div className="profile-name">{account.user.email}</div>
            </div>
          </div>
          <button className="settings-primary-btn" type="button" onClick={handleLogout} disabled={authBusy}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="settings-card">
          <div className="settings-card-title">Sign in</div>
          <div className="settings-card-hint">Open the Trail website to connect your account.</div>
          {authNotice ? <div className="settings-card-hint">{authNotice}</div> : null}
          <div className="settings-row">
            <button
              className="settings-primary-btn"
              type="button"
              onClick={() => void handleSignIn()}
              disabled={authBusy}
            >
              {authBusy ? 'Opening…' : 'Sign in'}
            </button>
            <button className="settings-secondary-btn" type="button" onClick={() => setSettingsOpen(false)}>
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderSubscription = () => (
    <div className="settings-panel-scroll">
      <div className="settings-panel-title">Subscription</div>
      <div className="settings-panel-subtitle">Compare plans and manage billing status.</div>
      {networkBadge}
      {accountError}
      {!isAuthenticated ? (
        <div className="settings-card">
          <div className="settings-card-title">Sign in required</div>
          <div className="settings-card-hint">Connect an account to unlock paid plans and billing controls.</div>
        </div>
      ) : null}

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-card-title">Billing status</div>
            <div className="settings-card-hint">
              {account.billing?.failureReason ?? 'All systems normal.'}
            </div>
          </div>
          <span className="status-pill" data-tone={getBillingTone(account.billing?.state ?? 'none')}>
            {account.billing?.state ?? 'none'}
          </span>
        </div>
        <div className="settings-stat-grid">
          <div>
            <div className="settings-stat-label">Next charge</div>
            <div className="settings-stat-value">{formatDate(account.billing?.nextChargeAt)}</div>
          </div>
          <div>
            <div className="settings-stat-label">Last charge</div>
            <div className="settings-stat-value">{formatDate(account.billing?.lastChargeAt)}</div>
          </div>
          <div>
            <div className="settings-stat-label">Payment method</div>
            <div className="settings-stat-value">
              {account.billing?.paymentMethod
                ? `${account.billing.paymentMethod.brand} •••• ${account.billing.paymentMethod.last4}`
                : '—'}
            </div>
          </div>
        </div>
        <div className="settings-row">
          <button
            className="settings-secondary-btn"
            type="button"
            onClick={() => void handleBillingPortal()}
            disabled={!isAuthenticated || portalBusy}
          >
            {portalBusy ? 'Opening…' : 'Manage billing'}
          </button>
          <button
            className="settings-secondary-btn"
            type="button"
            onClick={() => void handleRefreshAccount()}
            disabled={portalBusy}
          >
            {portalBusy ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {subscriptionNotice ? <div className="settings-card-hint">{subscriptionNotice}</div> : null}
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-card-title">Billing interval</div>
            <div className="settings-card-hint">Switch between monthly and yearly pricing.</div>
          </div>
          <div className="popover-segment">
            <button
              type="button"
              className={`popover-segment-btn wide ${interval === 'month' ? 'active' : ''}`}
              onClick={() => setInterval('month')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`popover-segment-btn wide ${interval === 'year' ? 'active' : ''}`}
              onClick={() => setInterval('year')}
            >
              Yearly
            </button>
          </div>
        </div>
      </div>

      <div className="plan-grid">
        {sortedPlans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const price = interval === 'month' ? plan.priceMonthly : plan.priceYearly;
          return (
            <div
              key={plan.id}
              className={`plan-card${plan.highlight ? ' highlight' : ''}${isCurrent ? ' active' : ''}`}
            >
              <div className="plan-card-header">
                <div>
                  <div className="plan-card-name">{plan.name}</div>
                  <div className="plan-card-price">{formatPrice(price, plan.currency, interval)}</div>
                </div>
                {plan.highlight ? <span className="plan-badge">Popular</span> : null}
              </div>
              <ul className="plan-card-features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <button
                className={`plan-card-btn ${isCurrent ? 'active' : ''}`}
                type="button"
                disabled={!isAuthenticated || isCurrent || portalBusy}
                onClick={() => void handleCheckout(plan.id)}
              >
                {isCurrent ? 'Current plan' : portalBusy ? 'Opening…' : 'Choose plan'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderPreferences = () => (
    <div className="settings-panel-scroll">
      <div className="settings-panel-title">Preferences</div>
      <div className="settings-panel-subtitle">Tune how Trail looks, feels, and behaves.</div>

      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-title">Appearance</div>
          <div className="settings-section-hint">Density and typography choices.</div>
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

      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-title">Behavior</div>
          <div className="settings-section-hint">Limits, confirmations, and shortcuts.</div>
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

        <div className="settings-toggle-grid">
          <ToggleRow
            id="pref-confirm"
            label="Confirm new tree"
            description="Ask before creating a fresh tree."
            checked={settings?.confirmNewTree ?? true}
            onChange={(value) => updateSettings({ confirmNewTree: value })}
          />
          <ToggleRow
            id="pref-adaptive"
            label="Adaptive mode"
            description="Start new trees in your chosen layout and suggest others as it grows."
            checked={settings?.adaptiveMode ?? false}
            onChange={(value) => updateSettings({ adaptiveMode: value })}
          />
          <ToggleRow
            id="pref-shortcuts"
            label="Enable keyboard shortcuts"
            description="Use global shortcuts inside the panel."
            checked={settings?.shortcutsEnabled ?? true}
            onChange={(value) => updateSettings({ shortcutsEnabled: value })}
          />
        </div>

        <div className="popover-section">
          <div className="popover-label-small">Adaptive layouts</div>
          <div className="settings-checkbox-grid">
            {adaptiveLayoutOptions.map((mode) => (
              <CheckboxRow
                key={`adaptive-layout-${mode}`}
                id={`adaptive-layout-${mode}`}
                label={layoutLabels[mode]}
                checked={adaptiveLayouts[mode]}
                onChange={(value) => updateAdaptiveLayouts(mode, value)}
                disabled={!adaptiveModeEnabled || (adaptiveSelectedCount <= 1 && adaptiveLayouts[mode])}
              />
            ))}
          </div>
          <div className="popover-hint">
            {adaptiveModeEnabled
              ? 'Choose which layouts adaptive mode can suggest.'
              : 'Enable Adaptive mode to use these settings.'}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-title">Layout</div>
          <div className="settings-section-hint">Choose the graph arrangement.</div>
        </div>
        <div className="popover-section">
          <div className="popover-label-small">Layout</div>
          <div className="popover-segment">
            <button
              type="button"
              className={`popover-segment-btn ${layout.mode === 'mindmap' ? 'active' : ''}`}
              onClick={() => updateLayout({ mode: 'mindmap' })}
              aria-label="Mindmap layout"
            >
              <Icons.BrainCircuit size={14} />
            </button>
            <button
              type="button"
              className={`popover-segment-btn ${layout.mode === 'tree' ? 'active' : ''}`}
              onClick={() => updateLayout({ mode: 'tree' })}
              aria-label="Tree layout"
            >
              <Icons.Network size={14} />
            </button>
            <button
              type="button"
              className={`popover-segment-btn ${layout.mode === 'radial' ? 'active' : ''}`}
              onClick={() => updateLayout({ mode: 'radial' })}
              aria-label="Radial layout"
            >
              <Icons.Radius size={14} />
            </button>
          </div>
          <div className="layout-selected-label">{layoutLabels[layout.mode]}</div>
          <div className="popover-hint">{layoutHints[layout.mode]}</div>
          <button type="button" className="popover-reset-btn" onClick={resetLayout}>
            Reset to defaults
          </button>
          <button type="button" className="popover-reset-btn secondary" onClick={resetView}>
            Reset view (factory)
          </button>
        </div>

        {layout.mode === 'tree' ? (
          <div className="popover-section">
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
          </div>
        ) : layout.mode === 'mindmap' ? (
          <div className="popover-section">
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
          </div>
        ) : (
          <div className="popover-section">
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
          </div>
        )}
      </div>
    </div>
  );

  const renderShortcuts = () => {
    const isMac = metaKey?.long === 'cmd';
    const primaryKey = isMac ? '⌘' : 'Ctrl';
    const primaryLabel = isMac ? 'cmd' : 'ctrl';
    const shortcuts = [
      { action: 'Undo', combo: `${primaryKey}+Z (${primaryLabel}+z)` },
      { action: 'Redo', combo: `${primaryKey}+Shift+Z (${primaryLabel}+shift+z)` },
      { action: 'Search', combo: `${primaryKey}+F (${primaryLabel}+f)` },
    ];
    return (
      <div className="settings-panel-scroll">
        <div className="settings-panel-title">Shortcuts</div>
        <div className="settings-panel-subtitle">Stay fast with keyboard navigation.</div>
        <div className="settings-card">
          <div className="settings-card-title">Quick actions</div>
          <div className="settings-card-hint">Shortcuts respect the enabled state in Preferences.</div>
          <div className="shortcut-grid">
            {shortcuts.map((shortcut) => (
              <div key={shortcut.action} className="shortcut-row">
                <span>{shortcut.action}</span>
                <code>{shortcut.combo}</code>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPrivacy = () => {
    const capacityText = settings?.capacity === Infinity ? '∞' : String(settings?.capacity ?? '—');
    return (
      <div className="settings-panel-scroll">
        <div className="settings-panel-title">Data & Privacy</div>
        <div className="settings-panel-subtitle">Keep tabs on local storage and retention.</div>
        <div className="settings-card">
          <div className="settings-card-title">Local storage snapshot</div>
          <div className="settings-stat-grid">
            <div>
              <div className="settings-stat-label">Nodes stored</div>
              <div className="settings-stat-value">{nodeCount}</div>
            </div>
            <div>
              <div className="settings-stat-label">Tree capacity</div>
              <div className="settings-stat-value">{capacityText}</div>
            </div>
            <div>
              <div className="settings-stat-label">Open tab limit</div>
              <div className="settings-stat-value">{settings?.maxOpenTabs ?? '—'}</div>
            </div>
          </div>
          <div className="settings-card-hint">Trail stores data locally until you opt into sync.</div>
        </div>
      </div>
    );
  };

  const renderAbout = () => {
    const version =
      typeof chrome !== 'undefined' && chrome.runtime?.getManifest
        ? chrome.runtime.getManifest().version
        : 'dev';
    return (
      <div className="settings-panel-scroll">
        <div className="settings-panel-title">About</div>
        <div className="settings-panel-subtitle">Trail for sidepanel.</div>
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
      case 'profile':
        return renderProfile();
      case 'subscription':
        return renderSubscription();
      case 'preferences':
        return renderPreferences();
      case 'shortcuts':
        return renderShortcuts();
      case 'privacy':
        return renderPrivacy();
      case 'about':
        return renderAbout();
      default:
        return renderPreferences();
    }
  };

  return createPortal(
    <div className="settings-modal-overlay" onClick={() => setSettingsOpen(false)}>
      <div
        ref={popoverRef}
        className="settings-modal"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="settings-modal-header">
          <div>
            <div className="settings-modal-title">Settings</div>
            <div className="settings-modal-subtitle">Accounts, subscriptions, and preferences.</div>
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
          <nav className="settings-sidebar">
            {SETTINGS_SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  className={`settings-nav-item ${active ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.id)}
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
          <div className="settings-panel">{renderPanel()}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
