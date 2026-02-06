import { accountCopy } from "@trail/content";
import { Badge, PageHeader } from "@trail/ui";
import { internalApiJson } from "@/src/server/internal-api";
import {
  BillingPlansClient,
  type BillingPlanView,
} from "./BillingPlansClient";

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

      <BillingPlansClient plans={plans} />
    </section>
  );
}
