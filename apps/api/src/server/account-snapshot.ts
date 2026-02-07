import type { ExtensionConfigMap } from "@/src/server/extension-config";
import { getExtensionConfig } from "@/src/server/extension-config";
import type { SubscriptionSnapshot } from "@/src/server/subscription-access";
import { env } from "@/src/env";

export type PlanDefinition = {
  id: string;
  name: string;
  tier: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: string[];
  limits: { maxTrees: number; maxDevices: number; maxHistoryDays: number };
  highlight?: boolean;
  rank?: number;
};

const DEFAULT_PLANS: readonly PlanDefinition[] = [
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

type AccountUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  createdAt: string;
};

type AuthSessionGuest = {
  status: "guest";
};

type AuthSessionAuthenticated = {
  status: "authenticated";
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
};

type AccountSnapshot = {
  session: AuthSessionGuest | AuthSessionAuthenticated;
  user: AccountUser | null;
  subscription: SubscriptionSnapshot | null;
  billing: { state: "none" };
  plans: readonly PlanDefinition[];
  config: ExtensionConfigMap;
};

type DbUser = {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  createdAt: Date;
};

function toAccountUser(user: DbUser): AccountUser {
  const displayName = user.name ?? user.email ?? "User";
  return {
    id: user.id,
    email: user.email ?? "",
    displayName,
    avatarUrl: user.imageUrl ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function buildAccountSnapshot({
  user,
  accessToken,
  expiresAt,
  subscription = null,
}: {
  user: DbUser | null;
  accessToken?: string | null;
  expiresAt?: string | null;
  subscription?: SubscriptionSnapshot | null;
}): AccountSnapshot {
  const { config } = getExtensionConfig();
  if (!user || !accessToken) {
    return {
      session: { status: "guest" },
      user: null,
      subscription: null,
      billing: { state: "none" },
      plans: DEFAULT_PLANS,
      config,
    };
  }

  return {
    session: {
      status: "authenticated",
      accessToken,
      expiresAt: expiresAt ?? null,
    },
    user: toAccountUser(user),
    subscription,
    billing: { state: "none" },
    plans: DEFAULT_PLANS,
    config,
  };
}

export function listPlans() {
  if (!env.BILLING_TEST_MODE) {
    return DEFAULT_PLANS;
  }

  return DEFAULT_PLANS.map((plan) => {
    if (plan.id === "free") {
      return plan;
    }
    return {
      ...plan,
      priceMonthly: 0,
      priceYearly: 0,
    };
  });
}
