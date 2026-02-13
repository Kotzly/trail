import type { AccountConfig } from "@/src/server/extension-config";
import { trailPlans, type TrailPlanDefinition } from "@trail/content";

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
  planId: "free" | "pro" | "teams";
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
  plans: readonly TrailPlanDefinition[];
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
      plans: trailPlans,
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
    plans: trailPlans,
    config,
  };
}

export function listPlans() {
  return trailPlans;
}
