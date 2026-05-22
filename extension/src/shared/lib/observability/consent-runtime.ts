/**
 * Pure orchestration helper for the telemetry consent → client state
 * transition. The Sentry / PostHog start + stop side effects live in
 * `../observability.ts`; this module just routes the consent flags
 * through the provided hooks.
 *
 * Splitting this out keeps the consent contract testable without
 * pulling in `wxt/utils/storage` (which the node-based unit test
 * harness can't load).
 */

import type { TelemetryConsent } from "../../config/storage-items.js";
import type { ObservabilitySurface } from "./types.js";

export type ObservabilityHooks = {
  startSentry: (surface: ObservabilitySurface) => void;
  stopSentry: () => Promise<void>;
  startPostHog: (surface: ObservabilitySurface) => Promise<void>;
  stopPostHog: () => void;
};

/**
 * Bring the runtime clients in line with `consent` for `surface`.
 *
 * Each branch is independent and routes through the supplied hooks, so
 * the production hooks (which short-circuit on already-on / already-off
 * state) make the call idempotent — calling this twice with the same
 * consent never double-instruments.
 *
 * Critically, this is the code path that runs when a user denies
 * analytics and then re-grants at runtime; without it the gate in the
 * legacy single-shot `init` left Sentry and PostHog dormant until the
 * surface was reloaded.
 */
export async function applyConsent(
  consent: TelemetryConsent,
  surface: ObservabilitySurface,
  hooks: ObservabilityHooks,
): Promise<void> {
  if (consent.errors) {
    hooks.startSentry(surface);
  } else {
    await hooks.stopSentry();
  }

  if (consent.analytics) {
    await hooks.startPostHog(surface);
  } else {
    hooks.stopPostHog();
  }
}
