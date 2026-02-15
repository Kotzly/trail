import { db } from "@trail/db";
import type { ExtensionConfigMap } from "@/src/server/backend/extension-config";
import { addInterval, toApiInterval } from "@/src/server/backend/subscription/period";

export type PlanTier = "free" | "pro" | "teams" | "enterprise";

export type ApiSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "expired";

export type SubscriptionSnapshot = {
  id: string;
  planId: "free" | "pro" | "teams";
  status: ApiSubscriptionStatus;
  interval: "month" | "year" | null;
  pendingInterval: "month" | "year" | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  canceledAt: string | null;
};

const FEATURE_CONFIG_PREFIX = "feature.";
const FEATURE_MIN_TIER_SUFFIX = ".minTier";

const TIER_ORDER: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  teams: 2,
  enterprise: 3,
};

function toIso(date: Date): string {
  return date.toISOString();
}

function buildFreeSubscription(_createdAt: Date): SubscriptionSnapshot {
  return {
    id: "sub_free",
    planId: "free",
    status: "active",
    interval: null,
    pendingInterval: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    canceledAt: null,
  };
}

function mapDbPlanToTier(plan: "FREE" | "PRO" | "TEAMS" | null | undefined): PlanTier {
  switch (plan) {
    case "PRO":
      return "pro";
    case "TEAMS":
      return "teams";
    case "FREE":
    default:
      return "free";
  }
}

function mapDbPlanToPlanId(
  plan: "FREE" | "PRO" | "TEAMS" | null | undefined,
): "free" | "pro" | "teams" {
  switch (plan) {
    case "PRO":
      return "pro";
    case "TEAMS":
      return "teams";
    case "FREE":
    default:
      return "free";
  }
}

function mapDbStatusToApiStatus(
  status:
    | "ACTIVE"
    | "TRIALING"
    | "PAST_DUE"
    | "CANCELED"
    | "UNPAID"
    | "INCOMPLETE"
    | "UNKNOWN"
    | null
    | undefined,
): ApiSubscriptionStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "TRIALING":
      return "trialing";
    case "PAST_DUE":
    case "UNPAID":
      return "past_due";
    case "CANCELED":
      // Historical rows used CANCELED to represent "non-renewing" subscriptions.
      // The source of truth is now `cancelAtPeriodEnd`, not `status`.
      return "active";
    case "INCOMPLETE":
    case "UNKNOWN":
    default:
      return "paused";
  }
}

export function normalizePlanTier(
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

export function hasTierAccess(current: PlanTier, required: PlanTier): boolean {
  return TIER_ORDER[current] >= TIER_ORDER[required];
}

export function getFeatureMinTier(
  config: ExtensionConfigMap,
  featureKey: string,
  fallback: PlanTier = "free",
): PlanTier {
  const key = `${FEATURE_CONFIG_PREFIX}${featureKey}${FEATURE_MIN_TIER_SUFFIX}`;
  return normalizePlanTier(config[key], fallback);
}

export async function getUserPlanTier(userId: string): Promise<PlanTier> {
  const subscription = await db.userSubscription.findUnique({
    where: { userId },
    select: { plan: true, currentPeriodEnd: true },
  });
  if (subscription?.currentPeriodEnd && subscription.currentPeriodEnd.getTime() <= Date.now()) {
    return "free";
  }
  return mapDbPlanToTier(subscription?.plan);
}

export async function getFeatureAccessForUser({
  userId,
  config,
  featureKey,
  fallbackMinTier = "free",
}: {
  userId: string;
  config: ExtensionConfigMap;
  featureKey: string;
  fallbackMinTier?: PlanTier;
}): Promise<{ allowed: boolean; currentTier: PlanTier; requiredTier: PlanTier }> {
  const requiredTier = getFeatureMinTier(config, featureKey, fallbackMinTier);
  const currentTier = await getUserPlanTier(userId);
  return {
    allowed: hasTierAccess(currentTier, requiredTier),
    currentTier,
    requiredTier,
  };
}

export async function getSubscriptionSnapshotForUser(
  params: { userId: string; fallbackCreatedAt?: Date },
): Promise<SubscriptionSnapshot | null> {
  const { userId, fallbackCreatedAt } = params;
  const subscription = await db.userSubscription.findUnique({
    where: { userId },
    select: {
      id: true,
      plan: true,
      status: true,
      createdAt: true,
      interval: true,
      pendingInterval: true,
      cancelAtPeriodEnd: true,
      canceledAt: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  });

  if (!subscription) {
    return fallbackCreatedAt ? buildFreeSubscription(fallbackCreatedAt) : null;
  }

  const currentPeriodStart =
    subscription.currentPeriodStart ?? subscription.createdAt;
  const interval = toApiInterval(subscription.interval);
  const currentPeriodEnd =
    subscription.currentPeriodEnd ?? addInterval(currentPeriodStart, interval);

  const isExpired = currentPeriodEnd.getTime() <= Date.now();
  const status = isExpired ? "expired" : mapDbStatusToApiStatus(subscription.status);
  const planId = isExpired ? "free" : mapDbPlanToPlanId(subscription.plan);
  const effectiveInterval = isExpired || planId === "free" ? null : interval;
  const pendingInterval =
    isExpired || planId === "free"
      ? null
      : subscription.pendingInterval
        ? toApiInterval(subscription.pendingInterval)
        : null;

  return {
    id: subscription.id,
    planId,
    status,
    interval: effectiveInterval,
    pendingInterval,
    currentPeriodStart: planId === "free" ? null : toIso(currentPeriodStart),
    currentPeriodEnd: planId === "free" ? null : toIso(currentPeriodEnd),
    cancelAtPeriodEnd: isExpired ? false : Boolean(subscription.cancelAtPeriodEnd),
    trialEndsAt: status === "trialing" ? toIso(currentPeriodEnd) : null,
    canceledAt: subscription.canceledAt ? toIso(subscription.canceledAt) : null,
  };
}
