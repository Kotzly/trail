import type { PlanDefinition } from "@/src/server/backend/account-snapshot";

export type PlanId = "free" | "pro" | "teams";
export type ApiInterval = "month" | "year";

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  pro: 1,
  teams: 2,
};

export function isUpgrade(from: PlanId, to: PlanId): boolean {
  return PLAN_RANK[to] > PLAN_RANK[from];
}

export function requirePaidPlan(planId: string): asserts planId is Exclude<PlanId, "free"> {
  if (planId !== "pro" && planId !== "teams") {
    throw new Error("Plan is not available.");
  }
}

function priceFor(plan: PlanDefinition, interval: ApiInterval): number {
  return interval === "year" ? plan.priceYearly : plan.priceMonthly;
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function proratedUpgradeChargeCents({
  now,
  currentPeriodStart,
  currentPeriodEnd,
  fromPlan,
  toPlan,
  interval,
}: {
  now: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  fromPlan: PlanDefinition;
  toPlan: PlanDefinition;
  interval: ApiInterval;
}): { chargeCents: number; creditCents: number; remainingRatio: number } {
  const periodMs = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
  const remainingMs = Math.max(0, currentPeriodEnd.getTime() - now.getTime());
  const remainingRatio = clamp01(periodMs <= 0 ? 0 : remainingMs / periodMs);

  const oldCents = toCents(priceFor(fromPlan, interval));
  const newCents = toCents(priceFor(toPlan, interval));

  // Credit for remaining time on the old plan.
  const creditCents = Math.round(oldCents * remainingRatio);
  const proratedNewCents = Math.round(newCents * remainingRatio);
  const chargeCents = proratedNewCents - creditCents;

  return { chargeCents, creditCents, remainingRatio };
}

