import type { AccountConfig, PlanTier, Subscription } from '../types/account.js';

const FEATURE_CONFIG_PREFIX = 'feature.';
const FEATURE_MIN_TIER_SUFFIX = '.minTier';

const TIER_ORDER: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  teams: 2,
  enterprise: 3,
};

export function normalizePlanTier(
  value: unknown,
  fallback: PlanTier = 'free',
): PlanTier {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'free' ||
    normalized === 'pro' ||
    normalized === 'teams' ||
    normalized === 'enterprise'
  ) {
    return normalized;
  }
  return fallback;
}

export function hasTierAccess(current: PlanTier, required: PlanTier): boolean {
  return TIER_ORDER[current] >= TIER_ORDER[required];
}

export function resolveCurrentTier(subscription: Subscription | null): PlanTier {
  return normalizePlanTier(subscription?.planId, 'free');
}

export function getFeatureMinTier(
  config: AccountConfig,
  featureKey: string,
  fallback: PlanTier = 'free',
): PlanTier {
  const key = `${FEATURE_CONFIG_PREFIX}${featureKey}${FEATURE_MIN_TIER_SUFFIX}`;
  return normalizePlanTier(config[key], fallback);
}

export function getFeatureAccess(params: {
  config: AccountConfig;
  subscription: Subscription | null;
  featureKey: string;
  fallbackMinTier?: PlanTier;
}): { allowed: boolean; currentTier: PlanTier; requiredTier: PlanTier } {
  const requiredTier = getFeatureMinTier(
    params.config,
    params.featureKey,
    params.fallbackMinTier ?? 'free',
  );
  const currentTier = resolveCurrentTier(params.subscription);
  return {
    allowed: hasTierAccess(currentTier, requiredTier),
    currentTier,
    requiredTier,
  };
}
