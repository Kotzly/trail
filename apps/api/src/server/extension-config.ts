import { normalizePlanTier } from "@/src/server/subscription-access";

export type ExtensionConfigValue = boolean | number | string | null;
export type ExtensionConfigMap = Record<string, ExtensionConfigValue>;

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
  },
};

export function getExtensionConfig(): ExtensionConfig {
  return {
    config: { ...EXTENSION_CONFIG.config },
  };
}
