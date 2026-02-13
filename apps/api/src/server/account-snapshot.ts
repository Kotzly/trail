import type { ExtensionConfigMap } from "@/src/server/extension-config";
import { getExtensionConfig } from "@/src/server/extension-config";
import type { SubscriptionSnapshot } from "@/src/server/subscription-access";
import { env } from "@/src/env";
import { trailPlans, type TrailPlanDefinition } from "@trail/content";

export type PlanDefinition = TrailPlanDefinition;

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
  if (!env.BILLING_TEST_MODE) {
    return trailPlans;
  }

  return trailPlans.map((plan) => {
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
