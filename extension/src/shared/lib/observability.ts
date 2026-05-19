/**
 * Unified observability module for Trail — wraps Sentry (errors) and
 * PostHog (product analytics) behind a single API.
 *
 * Design:
 * - Opt-out by default-ON but easily toggled in settings. Consent is stored
 *   in `telemetryConsentItem`.
 * - Every identity uses a per-install anonymous UUID (`telemetryAnonIdItem`),
 *   never the user's email or auth ID.
 * - PII masking: URL/title stripped from Sentry events before send.
 * - Safe no-op if env vars are missing — the extension runs fine without
 *   observability configured (e.g., local dev, unpublished builds).
 *
 * Per-surface init: the sidepanel, settings page, and background SW each
 * call `initObservability("sidepanel" | "settings" | "background")` on
 * startup. PostHog persists per-tab; Sentry is process-scoped.
 */

import * as Sentry from "@sentry/browser";
import type PostHog from "posthog-js-lite";
import {
  telemetryAnonIdItem,
  telemetryConsentItem,
  type TelemetryConsent,
} from "../config/storage-items.js";
import {
  hasTelemetryPermission,
  onTelemetryPermissionRemoved,
  requestTelemetryPermission,
} from "./firefox-data-permissions.js";

export type ObservabilitySurface = "sidepanel" | "settings" | "background" | "content" | "login";

export type BugReport = {
  message: string;
  name?: string;
  email?: string;
  /** When the report is filed from a caught error, pass its Sentry event id here. */
  associatedEventId?: string;
  /** Free-form tags merged into the Sentry feedback event (e.g. {"source": "error_boundary"}). */
  tags?: Record<string, string | number | boolean>;
};

export type AnalyticsEvent =
  | "install"
  | "update"
  | "sidepanel_opened"
  | "settings_opened"
  | "onboarding_started"
  | "onboarding_step_viewed"
  | "onboarding_completed"
  | "onboarding_skipped"
  | "onboarding_phase_entered"
  | "onboarding_persona_picked"
  | "onboarding_tour_tree_created"
  | "onboarding_tour_branched"
  | "onboarding_tour_completed"
  | "onboarding_tour_dismissed"
  | "onboarding_tour_resumed"
  | "onboarding_tour_resume_orphan"
  | "onboarding_soft_cta_shown"
  | "onboarding_soft_cta_clicked"
  | "onboarding_soft_cta_dismissed"
  | "command_palette_opened"
  | "node_created"
  | "node_deleted"
  | "node_renamed"
  | "node_reparented"
  | "tree_created"
  | "tree_switched"
  | "tree_exported"
  | "tree_imported"
  | "search_used"
  | "auth_signin_started"
  | "auth_signin_completed"
  | "auth_signin_failed"
  | "auth_signup_started"
  | "auth_signup_completed"
  | "auth_signup_failed"
  | "auth_otp_requested"
  | "auth_otp_verified"
  | "auth_otp_failed"
  | "auth_password_reset_requested"
  | "auth_password_changed"
  | "auth_signout"
  | "auth_user_changed_wipe"
  | "sync_ok"
  | "sync_failed"
  // Sync-conflict resolution (§ sync-wiggly-hellman plan)
  | "sync_conflict_shown"
  | "sync_conflict_dialog_opened"
  | "sync_conflict_preview_loaded"
  | "sync_conflict_preview_failed"
  | "sync_conflict_picks_changed"
  | "sync_conflict_apply_started"
  | "sync_conflict_apply_ok"
  | "sync_conflict_apply_failed"
  | "sync_conflict_stale_reload"
  | "sync_conflict_invalid_merge"
  | "sync_conflict_abandoned"
  | "sync_conflict_oversized_fallback"
  | "sync_conflict_soft_deleted_flow"
  | "delete_executed"
  | "delete_undone"
  | "delete_dedup_dropped_push"
  | "delete_remote_propagated"
  | "feedback_submitted"
  | "telemetry_opted_out"
  | "telemetry_opted_in"
  // Motion platform (§0.5) — anonymous perf/behavior signal only
  | "graph.hover"
  | "graph.frame_drop"
  | "graph.motion_degraded"
  | "graph.ambient_session"
  // Trail sharing
  | "share_create_succeeded"
  | "share_create_failed"
  | "share_revoked"
  | "share_import_needs_signin"
  | "share_import_success"
  | "share_import_failed"
  | "share_import_pending_consumed";

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const SENTRY_DSN = import.meta.env.WXT_SENTRY_DSN;
const POSTHOG_KEY = import.meta.env.WXT_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.WXT_POSTHOG_HOST ?? "https://eu.i.posthog.com";
const RELEASE = `trail-extension@${import.meta.env.WXT_VERSION ?? "dev"}`;
const ENVIRONMENT = import.meta.env.WXT_RELEASE_CHANNEL ?? "dev";

let initialized = false;
let sentryEnabled = false;
let posthogClient: PostHog | null = null;
let cachedConsent: TelemetryConsent | null = null;
let currentSurface: ObservabilitySurface = "sidepanel";

async function ensureAnonId(): Promise<string> {
  const existing = await telemetryAnonIdItem.getValue();
  if (existing) return existing;
  const next = crypto.randomUUID();
  await telemetryAnonIdItem.setValue(next);
  return next;
}

/**
 * Scrub URLs, titles, and user content from a Sentry event before send.
 * We keep breadcrumbs about what surface fired the event and technical
 * error details, but never ship the user's browsing data to Sentry.
 */
function scrubSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  // Scrub request URL (might contain Trail-internal URLs with tree ids)
  if (event.request?.url) {
    try {
      const url = new URL(event.request.url);
      event.request.url = `${url.origin}${url.pathname}`;
    } catch {
      // leave as-is if unparseable
    }
  }
  // Redact any "url" or "title" field in breadcrumbs
  event.breadcrumbs?.forEach((bc) => {
    if (bc.data && typeof bc.data === "object") {
      if ("url" in bc.data) bc.data.url = "[redacted]";
      if ("title" in bc.data) bc.data.title = "[redacted]";
    }
  });
  // Strip any contexts whose key suggests user data
  if (event.contexts) {
    for (const key of Object.keys(event.contexts)) {
      if (/node|url|title|tree/i.test(key)) {
        delete event.contexts[key];
      }
    }
  }
  return event;
}

/**
 * Install global JS error handlers for a DOM-scoped surface. Service worker
 * wires its own listeners in `service-worker.ts`.
 */
function installGlobalErrorHandlers(surface: ObservabilitySurface): void {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (event) => {
    captureError(event.error ?? event.message, { surface, kind: "window_error" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    captureError(event.reason, { surface, kind: "unhandled_rejection" });
  });
}

/**
 * Initialize observability for a given surface. Safe to call multiple
 * times — only the first call with a given surface wins.
 */
export async function initObservability(surface: ObservabilitySurface): Promise<void> {
  if (initialized) return;
  initialized = true;
  currentSurface = surface;

  try {
    cachedConsent = await telemetryConsentItem.getValue();
  } catch {
    cachedConsent = { errors: true, analytics: true, decidedAt: null };
  }

  // Firefox: the AMO manifest declares `technicalAndInteraction` as
  // OPTIONAL. The install dialog tells the user telemetry is opt-in,
  // so the permission must actually be granted before Sentry/PostHog
  // can run — Trail's internal consent toggle is not enough on its
  // own. When the permission is missing we force consent off for this
  // session regardless of what's in storage; the user can re-enable
  // from Settings → Privacy, which re-prompts Firefox for the grant.
  if (import.meta.env.FIREFOX) {
    const permitted = await hasTelemetryPermission();
    if (!permitted) {
      cachedConsent = { ...cachedConsent, errors: false, analytics: false };
    }
    // Mid-session revoke from about:addons → tear down clients so we
    // stop sending immediately, matching what the user just disabled
    // at the browser level.
    onTelemetryPermissionRemoved(() => {
      void setTelemetryConsent({ errors: false, analytics: false });
    });
  }

  // Sentry ——————————————————————————————
  if (SENTRY_DSN && cachedConsent.errors) {
    try {
      // Default integrations include BrowserApiErrors, Breadcrumbs, and
      // GlobalHandlers — each of which touches `window`/`document`. In a
      // MV3 service worker `document` is undefined, so letting the default
      // set load causes Sentry to silently disable itself and drop real
      // SW errors on the floor (closes P1.14).
      const integrations = surface === "background" ? [] : undefined;
      const defaultIntegrations = surface === "background" ? false : undefined;
      Sentry.init({
        dsn: SENTRY_DSN,
        release: RELEASE,
        environment: ENVIRONMENT,
        initialScope: { tags: { surface } },
        tracesSampleRate: 0,
        sendDefaultPii: false,
        beforeSend: scrubSentryEvent,
        ...(integrations ? { integrations } : {}),
        ...(defaultIntegrations === false ? { defaultIntegrations } : {}),
      });
      sentryEnabled = true;
    } catch (error) {
      console.warn("[observability] Sentry init failed:", error);
    }
  }

  if (surface !== "background") {
    installGlobalErrorHandlers(surface);
  }

  // PostHog ————————————————————————————
  // Dynamic import so the ~110 KB library never lands in the background
  // service-worker chunk (closes P2.16). PostHog has no function there:
  // `surface !== "background"` guards the init, but a static top-level
  // import bundles it regardless.
  if (POSTHOG_KEY && cachedConsent.analytics && surface !== "background") {
    try {
      const { default: PostHogLite } = await import("posthog-js-lite");
      const anonId = await ensureAnonId();
      const ph = new PostHogLite(POSTHOG_KEY, { host: POSTHOG_HOST });
      ph.identify(anonId);
      ph.register({ surface, release: RELEASE, environment: ENVIRONMENT });
      posthogClient = ph;
    } catch (error) {
      console.warn("[observability] PostHog init failed:", error);
    }
  }
}

/**
 * Report a handled exception to Sentry. If Sentry is disabled, logs to
 * console only.
 */
export function captureError(error: unknown, context?: AnalyticsProperties): void {
  if (sentryEnabled) {
    Sentry.captureException(error, context ? { extra: context } : undefined);
    return;
  }
  if (import.meta.env.DEV) {
    console.error("[observability] captureError:", error, context);
  }
}

/**
 * Track a product analytics event. No-op if PostHog is disabled.
 */
export function captureEvent(event: AnalyticsEvent, props?: AnalyticsProperties): void {
  posthogClient?.capture(event, { ...(props ?? {}), surface: currentSurface });
}

/**
 * The Sentry event id of the most recent captured error, or `undefined`
 * if no error has been captured (or Sentry is disabled). Used by the bug
 * report dialog to attach the current error to the user's report.
 */
export function lastErrorEventId(): string | undefined {
  if (!sentryEnabled) return undefined;
  return Sentry.lastEventId();
}

/**
 * Send a user-authored bug report to Sentry. Returns the event id so the
 * caller can show a "thanks, reference: xyz" receipt, or `null` if the
 * report could not be sent (consent off or DSN missing) — callers should
 * fall back to a mailto/github link in that case.
 */
export function captureBugReport(report: BugReport): string | null {
  if (!sentryEnabled) {
    if (import.meta.env.DEV) {
      console.warn("[observability] captureBugReport dropped (Sentry disabled):", report);
    }
    return null;
  }
  const tags = {
    surface: currentSurface,
    source: "user_bug_report",
    ...(report.tags ?? {}),
  };
  return Sentry.captureFeedback(
    {
      message: report.message,
      name: report.name,
      email: report.email,
      associatedEventId: report.associatedEventId,
      tags,
    },
    { includeReplay: false },
  );
}

/**
 * Update consent. If consent is revoked, we tear down and stop sending.
 */
export async function setTelemetryConsent(next: Partial<TelemetryConsent>): Promise<void> {
  // Firefox: enabling either signal requires the AMO-declared optional
  // permission. Request it first (must be called early in the await
  // chain so Firefox still sees this as a user gesture). If the user
  // declines, force the corresponding flags back to `false` before
  // saving — the stored consent must never claim a signal is on while
  // the browser has denied us the permission to send it.
  let effective: Partial<TelemetryConsent> = next;
  if (import.meta.env.FIREFOX && (next.errors === true || next.analytics === true)) {
    const granted = await requestTelemetryPermission();
    if (!granted) {
      effective = {
        ...next,
        ...(next.errors === true ? { errors: false } : {}),
        ...(next.analytics === true ? { analytics: false } : {}),
      };
    }
  }

  const current = (await telemetryConsentItem.getValue()) ?? {
    errors: true,
    analytics: true,
    decidedAt: null,
  };
  const merged: TelemetryConsent = {
    ...current,
    ...effective,
    decidedAt: Date.now(),
  };
  await telemetryConsentItem.setValue(merged);
  cachedConsent = merged;

  // Disable clients if consent was revoked. We don't re-enable mid-session
  // (requires surface reload); the toggle in Settings reloads on change.
  if (!merged.errors && sentryEnabled) {
    await Sentry.close();
    sentryEnabled = false;
  }
  if (!merged.analytics && posthogClient) {
    posthogClient.optOut();
    posthogClient = null;
  }
}

export async function getTelemetryConsent(): Promise<TelemetryConsent> {
  if (cachedConsent) return cachedConsent;
  const fromStorage = await telemetryConsentItem.getValue();
  cachedConsent = fromStorage;
  return fromStorage;
}

/**
 * Reset anonymous ID — called on sign-out, or from the GDPR delete flow.
 */
export async function resetTelemetryIdentity(): Promise<void> {
  await telemetryAnonIdItem.setValue(null);
  posthogClient?.reset();
}

// ── Feature flags ──────────────────────────────────────────────────
//
// Thin wrapper over PostHog feature flags with consent + initialization
// guards. Motion config (and any other runtime-toggleable feature) reads
// through here; never call posthog.getFeatureFlag() directly from UI code.
//
// Unknown / missing flags return `undefined` so callers can fall back
// to a compile-time default — mid-session "no signal" must not flip the
// UI to a different behaviour than the defaults baked in.

/**
 * Read a single boolean flag synchronously from the cached PostHog
 * snapshot. Returns undefined if PostHog is not initialized, consent is
 * off, or the flag isn't in the snapshot yet.
 */
export function readFeatureFlag(key: string): boolean | undefined {
  if (!posthogClient) return undefined;
  const raw = posthogClient.getFeatureFlag(key);
  if (typeof raw === "boolean") return raw;
  return undefined;
}

/**
 * Read a set of boolean flags as a plain object. Missing flags are
 * omitted from the result (not set to false) so callers can distinguish
 * "flag turned off" from "no signal yet".
 */
export function readFeatureFlagSnapshot(keys: readonly string[]): Record<string, boolean> {
  if (!posthogClient) return {};
  const result: Record<string, boolean> = {};
  for (const key of keys) {
    const raw = posthogClient.getFeatureFlag(key);
    if (typeof raw === "boolean") result[key] = raw;
  }
  return result;
}

/**
 * Ask PostHog to re-fetch feature flags from the server. Resolves when
 * the new snapshot is available (or immediately if PostHog is disabled).
 */
export async function reloadFeatureFlags(): Promise<void> {
  if (!posthogClient) return;
  const reload = posthogClient
    .reloadFeatureFlagsAsync()
    .then(() => undefined)
    .catch(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5_000));
  await Promise.race([reload, timeout]);
}
