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
 * All three are no-ops on non-Firefox builds (tree-shaken via
 * `import.meta.env.FIREFOX`) and on Firefox <140 where the
 * `data_collection` array shape isn't recognized — there the AMO
 * disclosure is the only contract and Trail's internal consent gates
 * telemetry on its own.
 */
import { browser } from "@shared/platform/webext.js";

const TELEMETRY_PERMISSION = "technicalAndInteraction";

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

export async function hasTelemetryPermission(): Promise<boolean> {
  if (!import.meta.env.FIREFOX) return true;
  const api = getPermissionsAPI();
  if (!api?.contains) return true;
  try {
    return await api.contains({ data_collection: [TELEMETRY_PERMISSION] });
  } catch {
    return true;
  }
}

export async function requestTelemetryPermission(): Promise<boolean> {
  if (!import.meta.env.FIREFOX) return true;
  const api = getPermissionsAPI();
  if (!api?.request) return true;
  try {
    return await api.request({ data_collection: [TELEMETRY_PERMISSION] });
  } catch {
    return true;
  }
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
