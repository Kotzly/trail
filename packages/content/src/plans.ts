export type TrailPlanId = "free" | "pro" | "teams";

export type TrailPlanDefinition = {
  id: TrailPlanId;
  name: string;
  tier: TrailPlanId;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: string[];
  limits: {
    maxTrees: number;
    maxDevices: number;
    maxHistoryDays: number;
  };
  highlight?: boolean;
  rank?: number;
};

export const trailPlans: readonly TrailPlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    tier: "free",
    priceMonthly: 0,
    priceYearly: 0,
    currency: "USD",
    features: ["Basic navigation history", "Up to 3 trees", "Local-only data"],
    limits: { maxTrees: 3, maxDevices: 1, maxHistoryDays: 7 },
    rank: 0,
  },
  {
    id: "pro",
    name: "Pro",
    tier: "pro",
    priceMonthly: 8,
    priceYearly: 72,
    currency: "USD",
    features: ["Unlimited trees", "Sync across devices", "Priority rendering"],
    limits: { maxTrees: 999, maxDevices: 5, maxHistoryDays: 90 },
    highlight: true,
    rank: 1,
  },
  {
    id: "teams",
    name: "Teams",
    tier: "teams",
    priceMonthly: 16,
    priceYearly: 144,
    currency: "USD",
    features: ["Shared workspaces", "Team analytics", "Admin controls"],
    limits: { maxTrees: 999, maxDevices: 15, maxHistoryDays: 180 },
    rank: 2,
  },
];
