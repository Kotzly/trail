import { db } from "@trail/db";
import { maybeRow } from "@trail/db/helpers";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
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

type DbPlan = "FREE" | "PRO" | "TEAMS" | null | undefined;
type DbStatus =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "INCOMPLETE"
  | "UNKNOWN"
  | null
  | undefined;

type UserSubscriptionRow = {
  id: string;
  plan: DbPlan;
  status: DbStatus;
  created_at: string;
  interval: string | null;
  pending_interval: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  updated_at: string;
};

function typed<T>(res: unknown): PostgrestSingleResponse<T> {
  return res as PostgrestSingleResponse<T>;
}

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

function mapDbPlanToTier(plan: DbPlan): PlanTier {
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

function mapDbPlanToPlanId(plan: DbPlan): "free" | "pro" | "teams" {
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

function mapDbStatusToApiStatus(status: DbStatus): ApiSubscriptionStatus {
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
  const subscription = maybeRow(
    typed<Pick<UserSubscriptionRow, "plan" | "current_period_end"> | null>(
      await db
        .from("user_subscriptions")
        .select("plan, current_period_end")
        .eq("user_id", userId)
        .maybeSingle(),
    ),
  );
  if (
    subscription?.current_period_end &&
    new Date(subscription.current_period_end).getTime() <= Date.now()
  ) {
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
  const subscription = maybeRow(
    typed<UserSubscriptionRow | null>(
      await db
        .from("user_subscriptions")
        .select(
          "id, plan, status, created_at, interval, pending_interval, cancel_at_period_end, canceled_at, current_period_start, current_period_end",
        )
        .eq("user_id", userId)
        .maybeSingle(),
    ),
  );

  if (!subscription) {
    return fallbackCreatedAt ? buildFreeSubscription(fallbackCreatedAt) : null;
  }

  const currentPeriodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start)
    : new Date(subscription.created_at);
  const interval = toApiInterval(subscription.interval as "MONTH" | "YEAR" | null | undefined);
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : addInterval(currentPeriodStart, interval);

  const isExpired = currentPeriodEnd.getTime() <= Date.now();
  const status = isExpired ? "expired" : mapDbStatusToApiStatus(subscription.status);
  const planId = isExpired ? "free" : mapDbPlanToPlanId(subscription.plan);
  const effectiveInterval = isExpired || planId === "free" ? null : interval;
  const pendingInterval =
    isExpired || planId === "free"
      ? null
      : subscription.pending_interval
        ? toApiInterval(subscription.pending_interval as "MONTH" | "YEAR" | null | undefined)
        : null;

  return {
    id: subscription.id,
    planId,
    status,
    interval: effectiveInterval,
    pendingInterval,
    currentPeriodStart: planId === "free" ? null : toIso(currentPeriodStart),
    currentPeriodEnd: planId === "free" ? null : toIso(currentPeriodEnd),
    cancelAtPeriodEnd: isExpired ? false : Boolean(subscription.cancel_at_period_end),
    trialEndsAt: status === "trialing" ? toIso(currentPeriodEnd) : null,
    canceledAt: subscription.canceled_at ? toIso(new Date(subscription.canceled_at)) : null,
  };
}
