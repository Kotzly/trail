import type { AccountConfig, Plan, PlanTier, Subscription } from "../types/account.js";

const FEATURE_CONFIG_PREFIX = "feature.";
const FEATURE_MIN_TIER_SUFFIX = ".minTier";

const DEFAULT_TIER: PlanTier = "free";

function tierRank(plans: readonly Plan[], tier: PlanTier): number {
  const plan = plans.find((p) => p.tier === tier);
  return plan?.rank ?? -1;
}

export function hasTierAccess(
  plans: readonly Plan[],
  current: PlanTier,
  required: PlanTier,
): boolean {
  if (current === required) return true;
  return tierRank(plans, current) >= tierRank(plans, required);
}

export function resolveCurrentTier(subscription: Subscription | null): PlanTier {
  const tier = subscription?.planId;
  return typeof tier === "string" && tier.trim() ? tier.trim() : DEFAULT_TIER;
}

export function getFeatureMinTier(
  config: AccountConfig,
  featureKey: string,
  fallback: PlanTier = DEFAULT_TIER,
): PlanTier {
  const key = `${FEATURE_CONFIG_PREFIX}${featureKey}${FEATURE_MIN_TIER_SUFFIX}`;
  const value = config[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function getFeatureAccess(params: {
  plans: readonly Plan[];
  config: AccountConfig;
  subscription: Subscription | null;
  featureKey: string;
  fallbackMinTier?: PlanTier;
}): { allowed: boolean; currentTier: PlanTier; requiredTier: PlanTier } {
  const requiredTier = getFeatureMinTier(
    params.config,
    params.featureKey,
    params.fallbackMinTier ?? DEFAULT_TIER,
  );
  const currentTier = resolveCurrentTier(params.subscription);
  return {
    allowed: hasTierAccess(params.plans, currentTier, requiredTier),
    currentTier,
    requiredTier,
  };
}
