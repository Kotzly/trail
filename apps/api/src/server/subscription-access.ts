import { db } from "@trail/db";
import type { ExtensionConfigMap } from "@/src/server/extension-config";

export type PlanTier = "free" | "pro" | "teams" | "enterprise";

export type ApiSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "expired";

export type SubscriptionSnapshot = {
  id: string;
  planId: "free" | "pro" | "teams";
  status: ApiSubscriptionStatus;
  interval: "month";
  currentPeriodStart: string;
  currentPeriodEnd: string;
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

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function buildFreeSubscription(createdAt: Date): SubscriptionSnapshot {
  const periodEnd = addDays(createdAt, 30);
  return {
    id: "sub_free",
    planId: "free",
    status: "active",
    interval: "month",
    currentPeriodStart: toIso(createdAt),
    currentPeriodEnd: toIso(periodEnd),
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
      return "canceled";
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
      currentPeriodEnd: true,
    },
  });

  if (!subscription) {
    return fallbackCreatedAt ? buildFreeSubscription(fallbackCreatedAt) : null;
  }

  const currentPeriodStart = subscription.createdAt;
  const currentPeriodEnd =
    subscription.currentPeriodEnd ?? addDays(currentPeriodStart, 30);

  const isExpired = currentPeriodEnd.getTime() <= Date.now();
  const status = isExpired ? "expired" : mapDbStatusToApiStatus(subscription.status);
  const planId = isExpired ? "free" : mapDbPlanToPlanId(subscription.plan);

  return {
    id: subscription.id,
    planId,
    status,
    interval: "month",
    currentPeriodStart: toIso(currentPeriodStart),
    currentPeriodEnd: toIso(currentPeriodEnd),
    cancelAtPeriodEnd: status === "canceled",
    trialEndsAt: status === "trialing" ? toIso(currentPeriodEnd) : null,
    canceledAt: null,
  };
}
