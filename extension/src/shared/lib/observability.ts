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
import posthog, { type PostHog } from "posthog-js";
import {
  telemetryAnonIdItem,
  telemetryConsentItem,
  type TelemetryConsent,
} from "../config/storage-items.js";

export type ObservabilitySurface = "sidepanel" | "settings" | "background" | "content";

export type AnalyticsEvent =
  | "install"
  | "update"
  | "sidepanel_opened"
  | "settings_opened"
  | "onboarding_started"
  | "onboarding_step_viewed"
  | "onboarding_completed"
  | "onboarding_skipped"
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
  | "auth_signout"
  | "sync_ok"
  | "sync_failed"
  | "feedback_submitted"
  | "telemetry_opted_out"
  | "telemetry_opted_in"
  // Motion platform (§0.5) — anonymous perf/behavior signal only
  | "graph.hover"
  | "graph.frame_drop"
  | "graph.motion_degraded"
  | "graph.ambient_session";

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

  // Sentry ——————————————————————————————
  if (SENTRY_DSN && cachedConsent.errors) {
    try {
      Sentry.init({
        dsn: SENTRY_DSN,
        release: RELEASE,
        environment: ENVIRONMENT,
        initialScope: { tags: { surface } },
        // Capture only uncaught + explicitly reported errors
        tracesSampleRate: 0,
        sendDefaultPii: false,
        beforeSend: scrubSentryEvent,
      });
      sentryEnabled = true;
    } catch (error) {
      console.warn("[observability] Sentry init failed:", error);
    }
  }

  // PostHog ————————————————————————————
  if (POSTHOG_KEY && cachedConsent.analytics && surface !== "background") {
    try {
      const anonId = await ensureAnonId();
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        autocapture: false, // we only send explicit events
        capture_pageview: false, // no pageviews in extension UI
        capture_pageleave: false,
        persistence: "localStorage",
        disable_session_recording: true,
        disable_surveys: true,
        property_blacklist: ["$current_url", "$pathname", "$referrer"],
        loaded: (ph) => {
          ph.identify(anonId);
          ph.register({ surface, release: RELEASE, environment: ENVIRONMENT });
        },
      });
      posthogClient = posthog;
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
 * Update consent. If consent is revoked, we tear down and stop sending.
 */
export async function setTelemetryConsent(next: Partial<TelemetryConsent>): Promise<void> {
  const current = (await telemetryConsentItem.getValue()) ?? {
    errors: true,
    analytics: true,
    decidedAt: null,
  };
  const merged: TelemetryConsent = {
    ...current,
    ...next,
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
    posthogClient.opt_out_capturing();
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
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    // onFeatureFlags fires once flags arrive from the server
    posthogClient?.onFeatureFlags(() => done());
    posthogClient?.reloadFeatureFlags();
    // safety: don't hang callers if PostHog is unresponsive
    setTimeout(done, 5_000);
  });
}
