import { env } from "@/src/env";

export type ExtensionConfigValue = boolean | number | string | null;
export type ExtensionConfigMap = Record<string, ExtensionConfigValue>;
type PlanTier = "free" | "pro" | "teams" | "enterprise";

function normalizePlanTier(
  value: unknown,
  fallback: PlanTier = "free",
): PlanTier {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "free" ||
    normalized === "pro" ||
    normalized === "teams" ||
    normalized === "enterprise"
  ) {
    return normalized;
  }
  return fallback;
}

export type ExtensionConfig = {
  config: ExtensionConfigMap;
};

const trailsSyncMinTier = normalizePlanTier(
  process.env.TRAIL_FEATURE_TRAILS_SYNC_MIN_TIER,
  "free",
);

const EXTENSION_CONFIG: ExtensionConfig = {
  config: {
    payments: true,
    "feature.trailsSync.minTier": trailsSyncMinTier,
    "auth.extension.required": env.TRAIL_EXTENSION_AUTH_REQUIRED,
  },
};

export function getExtensionConfig(): ExtensionConfig {
  return {
    config: { ...EXTENSION_CONFIG.config },
  };
}
