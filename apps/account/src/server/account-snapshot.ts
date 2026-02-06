import type { AccountConfig } from "@/src/server/extension-config";

const DEFAULT_PLANS = [
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
] as const;

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

type AccountSubscription = {
  id: string;
  planId: "free" | "pro";
  status: "trialing" | "active" | "past_due" | "paused" | "canceled" | "expired";
  interval: "month";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  canceledAt: string | null;
};

type AccountSnapshot = {
  session: AuthSessionGuest | AuthSessionAuthenticated;
  user: AccountUser | null;
  subscription: AccountSubscription | null;
  billing: { state: "none" };
  plans: typeof DEFAULT_PLANS;
  config: AccountConfig;
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
  config = {},
  subscription = null,
}: {
  user: DbUser | null;
  accessToken?: string | null;
  expiresAt?: string | null;
  config?: AccountConfig;
  subscription?: AccountSubscription | null;
}): AccountSnapshot {
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
  return DEFAULT_PLANS;
}
