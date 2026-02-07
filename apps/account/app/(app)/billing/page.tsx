import { accountCopy } from "@trail/content";
import { Badge, PageHeader } from "@trail/ui";
import { internalApiJson } from "@/src/server/internal-api";
import { getAuthTokenFromCookies } from "@/src/lib/auth";
import {
  BillingPlansClient,
  type BillingPlanView,
} from "./BillingPlansClient";

export const dynamic = "force-dynamic";

type ApiPlan = {
  id: string;
  name: string;
  tier: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: string[];
  highlight?: boolean;
  rank?: number;
};

type ApiSubscription = {
  planId: "free" | "pro" | "teams";
  status: "trialing" | "active" | "past_due" | "paused" | "canceled" | "expired";
  interval: "month" | "year" | null;
  pendingInterval: "month" | "year" | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

async function getBillingPlans(): Promise<BillingPlanView[]> {
  const plans = await internalApiJson<ApiPlan[]>("/v1/plans", {
    method: "GET",
  }).catch(() => []);

  return plans
    .filter((plan) => Array.isArray(plan.features))
    .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER))
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      monthlyPrice: plan.priceMonthly,
      yearlyPrice: plan.priceYearly,
      currency: plan.currency,
      features: plan.features,
      popular: Boolean(plan.highlight),
    }));
}

export default async function BillingPage() {
  const { billing } = accountCopy;
  const plans = await getBillingPlans();
  const token = await getAuthTokenFromCookies();
  const subscription = token
    ? await internalApiJson<ApiSubscription>("/v1/subscription", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => null)
    : null;
  const currentPlanId = subscription?.planId ?? "free";
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;
  const currentPeriodEnd = subscription?.currentPeriodEnd ?? null;
  const currentInterval = subscription?.interval ?? null;
  const pendingInterval = subscription?.pendingInterval ?? null;

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow={accountCopy.nav.billing}
        title={billing.title}
        subtitle={billing.subtitle}
        meta={
          <>
            <Badge className="bg-surface-strong text-xs font-medium text-ink">
              {billing.badgeEarly}
            </Badge>
            <Badge className="bg-surface-strong text-xs font-medium text-ink">
              {billing.badgePreview}
            </Badge>
          </>
        }
      />

      <BillingPlansClient
        plans={plans}
        currentPlanId={currentPlanId}
        currentInterval={currentInterval}
        pendingInterval={pendingInterval}
        cancelAtPeriodEnd={cancelAtPeriodEnd}
        currentPeriodEnd={currentPeriodEnd}
      />
    </section>
  );
}
