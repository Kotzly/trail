// No-op replacement for @shared/lib/observability.js

export async function initObservability(): Promise<void> {
  // intentionally empty
}

export function captureEvent(name: string, props?: Record<string, unknown>): void {
  console.debug("[preview] captureEvent", name, props);
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  console.error("[preview] captureError", error, context);
}

export async function getTelemetryConsent(): Promise<{
  errors: boolean;
  analytics: boolean;
}> {
  return { errors: false, analytics: false };
}

export async function setTelemetryConsent(): Promise<void> {
  // intentionally empty
}

export function resetTelemetryIdentity(): void {
  // intentionally empty
}

// Feature flags — preview harness has no PostHog, so flag reads always
// return "no signal" and motion-config falls back to compile-time defaults.

export function readFeatureFlag(_key: string): boolean | undefined {
  return undefined;
}

export function readFeatureFlagSnapshot(_keys: readonly string[]): Record<string, boolean> {
  return {};
}

export async function reloadFeatureFlags(): Promise<void> {
  // intentionally empty
}
