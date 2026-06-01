/**
 * Firefox AMO optional data-collection permission helpers.
 *
 * The Firefox manifest declares `technicalAndInteraction` as an OPTIONAL
 * `data_collection_permissions` entry (see `wxt.config.ts`). Per AMO
 * policy, the install dialog reflects this as opt-in — the permission
 * is NOT granted automatically. We must therefore:
 *
 *   1. Check the permission at telemetry init (`hasTelemetryPermission`)
 *      and skip Sentry/PostHog if it has not been granted.
 *   2. Request the permission from a user gesture when the user enables
 *      telemetry in Settings → Privacy (`requestTelemetryPermission`).
 *   3. Watch for revocation from `about:addons` so a mid-session revoke
 *      tears down the running clients (`onTelemetryPermissionRemoved`).
 *
 * On non-Firefox builds these are no-ops that return `true` (tree-shaken
 * via `import.meta.env.FIREFOX`) — Chrome doesn't have AMO's
 * data-collection scheme. On Firefox <140 where the `data_collection`
 * array shape isn't recognized — and where the underlying `permissions`
 * API or its `contains`/`request` methods may be absent — we treat that
 * structural absence as "Trail's internal consent toggle is the only
 * contract" and return `true`.
 *
 * Fail-closed contract: when the API IS present but the underlying
 * `contains` / `request` call REJECTS (transient WebExtension error,
 * unexpected shape, etc.), the helpers return `false` — i.e. "permission
 * not granted". A privacy gate must never grant telemetry on the
 * strength of an error.
 *
 * Observability is injected via `setObservabilityReporter` rather than
 * statically imported so the module loads cleanly under `node --import
 * tsx` (the unit-test runtime doesn't polyfill the Vite virtual modules
 * `observability.ts` pulls in). It also keeps `observability.ts` →
 * `firefox-data-permissions.ts` the only static direction — observability
 * registers itself at `initObservability()` time.
 */
import { browser } from "@shared/platform/webext.js";

const TELEMETRY_PERMISSION = "technicalAndInteraction";

type ObservabilityReporter = (err: unknown, ctx: { tag: string; op: string }) => void;

// Default no-op so the module is standalone — observability registers a
// real reporter at `initObservability()` time. Unit tests that don't
// initialize observability still load this module without pulling in
// `observability.ts` (which depends on Vite virtuals).
let observabilityReporter: ObservabilityReporter = () => {};

/**
 * Register the function used to report permission-check failures.
 * Called once per surface from `observability.initObservability()` —
 * see the docstring at the top of this module for the rationale.
 */
export function setObservabilityReporter(reporter: ObservabilityReporter): void {
  observabilityReporter = reporter;
}

type DataCollectionPermissions = { data_collection?: string[] };

type PermissionsAPI = {
  contains?: (perms: DataCollectionPermissions) => Promise<boolean>;
  request?: (perms: DataCollectionPermissions) => Promise<boolean>;
  onRemoved?: {
    addListener: (cb: (perms: DataCollectionPermissions) => void) => void;
    removeListener: (cb: (perms: DataCollectionPermissions) => void) => void;
  };
};

function getPermissionsAPI(): PermissionsAPI | null {
  const api = (browser as unknown as { permissions?: PermissionsAPI }).permissions;
  return api ?? null;
}

/**
 * Report a permission-check failure to the injected observability
 * reporter (no-op until `setObservabilityReporter` is called). Any
 * failure inside the reporter is swallowed — the privacy decision is
 * already made by the caller's fail-closed return.
 */
function reportPermissionError(err: unknown, op: "contains" | "request"): void {
  try {
    observabilityReporter(err, { tag: "firefox-data-permissions", op });
  } catch {
    // Reporting itself failed — nothing more to do; the caller already
    // returned `false` so the gate is closed regardless.
  }
}

/**
 * Inner helper: call `permissions.contains` with fail-closed semantics.
 * Returns `false` (not granted) on any rejection and reports the error
 * to observability. Exported so unit tests can exercise the fail-closed
 * contract directly — the public `hasTelemetryPermission` short-circuits
 * on non-Firefox builds via `import.meta.env.FIREFOX`, which isn't set
 * in the unit-test runtime.
 */
export async function probeTelemetryPermission(
  contains: (perms: DataCollectionPermissions) => Promise<boolean>,
): Promise<boolean> {
  try {
    return await contains({ data_collection: [TELEMETRY_PERMISSION] });
  } catch (err) {
    reportPermissionError(err, "contains");
    return false;
  }
}

/**
 * Inner helper: call `permissions.request` with fail-closed semantics.
 * Returns `false` (not granted) on any rejection and reports the error
 * to observability. Exported for the same reason as
 * `probeTelemetryPermission`.
 */
export async function askForTelemetryPermission(
  request: (perms: DataCollectionPermissions) => Promise<boolean>,
): Promise<boolean> {
  try {
    return await request({ data_collection: [TELEMETRY_PERMISSION] });
  } catch (err) {
    reportPermissionError(err, "request");
    return false;
  }
}

export async function hasTelemetryPermission(): Promise<boolean> {
  if (!import.meta.env.FIREFOX) return true;
  const api = getPermissionsAPI();
  if (!api?.contains) return true;
  return probeTelemetryPermission(api.contains.bind(api));
}

export async function requestTelemetryPermission(): Promise<boolean> {
  if (!import.meta.env.FIREFOX) return true;
  const api = getPermissionsAPI();
  if (!api?.request) return true;
  return askForTelemetryPermission(api.request.bind(api));
}

export function onTelemetryPermissionRemoved(cb: () => void): () => void {
  if (!import.meta.env.FIREFOX) return () => {};
  const api = getPermissionsAPI();
  if (!api?.onRemoved) return () => {};
  const listener = (perms: DataCollectionPermissions) => {
    if (perms.data_collection?.includes(TELEMETRY_PERMISSION)) cb();
  };
  api.onRemoved.addListener(listener);
  return () => api.onRemoved?.removeListener(listener);
}
