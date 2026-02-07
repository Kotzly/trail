"use client";

import { useMemo, useState } from "react";
import { CheckIcon } from "@trail/ui/icons";
import { Button, cn, Badge } from "@trail/ui";
import { accountCopy } from "@trail/content";

export type BillingPlanView = {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  features: string[];
  popular: boolean;
};

type CheckoutResponse = {
  url: string;
  expiresAt: string | null;
};

type CancelResponse =
  | { planId: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: string }
  | { message?: string; redirectUrl?: string };

export function navigateTo(url: string): void {
  window.location.assign(url);
}

function formatAmount(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

function yearlyPricePerMonth(plan: BillingPlanView): number {
  if (plan.yearlyPrice <= 0) return 0;
  return plan.yearlyPrice / 12;
}

const TIER_ORDER: Record<string, number> = {
  free: 0,
  pro: 1,
  teams: 2,
};

function getTierRank(planId: string): number {
  return TIER_ORDER[planId] ?? Number.MAX_SAFE_INTEGER;
}

function getCta(planId: string, currentPlanId: string): string {
  if (planId === currentPlanId) {
    return "current plan";
  }

  const planRank = getTierRank(planId);
  const currentRank = getTierRank(currentPlanId);
  if (planRank < currentRank) {
    return `downgrade to ${planId}`;
  }

  switch (planId) {
    case "pro":
      return "upgrade to pro";
    case "teams":
      return "upgrade to teams";
    case "free":
      return "downgrade to free";
    default:
      return "choose plan";
  }
}

export function BillingPlansClient({
  plans,
  currentPlanId = "free",
  cancelAtPeriodEnd = false,
  currentPeriodEnd,
  onNavigate = navigateTo,
}: {
  plans: BillingPlanView[];
  currentPlanId?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  onNavigate?: (url: string) => void;
}) {
  const { billing } = accountCopy;
  const [isYearly, setIsYearly] = useState(true);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Preserve server-provided ordering (Free, Pro, Teams).
  const orderedPlans = useMemo(() => plans, [plans]);

  if (orderedPlans.length === 0) {
    return (
      <div className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-8 text-sm text-ink-muted">
        Plans are temporarily unavailable. Please try again in a moment.
      </div>
    );
  }

  async function startCheckout(planId: string): Promise<void> {
    const interval = isYearly ? "year" : "month";

    setPendingPlanId(planId);
    setError(null);
    setNotice(null);

    try {
      const origin = window.location.origin.replace(/\/$/, "");
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          interval,
          successUrl: `${origin}/billing?checkout=success`,
          cancelUrl: `${origin}/billing?checkout=cancelled`,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | CheckoutResponse
        | { message?: string; redirectUrl?: string }
        | null;

      if (response.status === 401 && payload && typeof payload === "object" && "redirectUrl" in payload) {
        const redirectUrl = payload.redirectUrl;
        if (typeof redirectUrl === "string" && redirectUrl) {
          onNavigate(redirectUrl);
          return;
        }
      }

      if (!response.ok || !payload || typeof (payload as CheckoutResponse).url !== "string") {
        const message =
          payload && typeof payload === "object" && "message" in payload
            ? (payload.message ?? "Could not start checkout.")
            : "Could not start checkout.";
        throw new Error(message);
      }

      onNavigate((payload as CheckoutResponse).url);
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error
          ? checkoutError.message
          : "Could not start checkout.";
      setError(message);
    } finally {
      setPendingPlanId(null);
    }
  }

  async function cancelSubscription(targetPlanId: string): Promise<void> {
    setPendingPlanId(targetPlanId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const payload = (await response.json().catch(() => null)) as CancelResponse | null;

      if (response.status === 401 && payload && typeof payload === "object" && "redirectUrl" in payload) {
        const redirectUrl = payload.redirectUrl;
        if (typeof redirectUrl === "string" && redirectUrl) {
          onNavigate(redirectUrl);
          return;
        }
      }

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload
            ? (payload.message ?? "Could not cancel subscription.")
            : "Could not cancel subscription.";
        throw new Error(message);
      }

      setNotice(
        "Downgrade scheduled. You'll keep access until the end of the current period.",
      );
      window.location.reload();
    } catch (cancelError) {
      const message =
        cancelError instanceof Error ? cancelError.message : "Could not cancel subscription.";
      setError(message);
    } finally {
      setPendingPlanId(null);
    }
  }

  return (
    <>
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center rounded-full border border-border/60 bg-surface/60 p-1">
          <button
            onClick={() => setIsYearly(false)}
            className={cn(
              "rounded-full px-4 py-2 text-sm lowercase transition",
              !isYearly ? "bg-cta text-cta-fg" : "text-ink-muted hover:text-ink",
            )}
          >
            monthly
          </button>
          <button
            onClick={() => setIsYearly(true)}
            className={cn(
              "rounded-full px-4 py-2 text-sm lowercase transition",
              isYearly ? "bg-cta text-cta-fg" : "text-ink-muted hover:text-ink",
            )}
          >
            yearly
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {orderedPlans.map((plan) => {
          const monthly = plan.monthlyPrice;
          const yearlyMonthly = yearlyPricePerMonth(plan);
          const selectedPrice = isYearly ? yearlyMonthly : monthly;
          const savingsPercent =
            monthly > 0 && yearlyMonthly > 0
              ? Math.round((1 - yearlyMonthly / monthly) * 100)
              : 0;

          return (
            <div
              key={plan.id}
              className={cn(
                "flex h-full flex-col rounded-[26px] border bg-surface/60 px-6 py-6",
                plan.popular ? "border-accent/40 bg-surface/80" : "border-border/60",
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold lowercase text-ink">
                    {plan.name}
                  </p>
                </div>
                {plan.popular && (
                  <Badge className="bg-cta text-xs font-semibold text-cta-fg lowercase">
                    {billing.planHighlight}
                  </Badge>
                )}
              </div>

              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-ink">
                    {selectedPrice === 0 ? "free" : formatAmount(selectedPrice, plan.currency)}
                  </span>
                  {selectedPrice > 0 && (
                    <span className="text-sm text-ink-muted lowercase">
                      /month
                    </span>
                  )}
                </div>
                {isYearly && savingsPercent > 0 && (
                  <p className="mt-1 text-xs text-accent">
                    save {savingsPercent}% with yearly
                  </p>
                )}
                {!isYearly && yearlyMonthly > 0 && (
                  <p className="mt-1 text-xs text-ink-subtle">
                    or {formatAmount(yearlyMonthly, plan.currency)}/month yearly
                  </p>
                )}
              </div>

              <ul className="mt-6 flex-1 space-y-2 text-xs text-ink-muted lowercase">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 h-3 w-3 flex-shrink-0 text-ink" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                <Button
                  size="sm"
                  variant={plan.popular ? "primary" : "outline"}
                  className="w-full lowercase"
                  disabled={
                    plan.id === currentPlanId ||
                    pendingPlanId === plan.id ||
                    (getTierRank(plan.id) < getTierRank(currentPlanId) &&
                      cancelAtPeriodEnd)
                  }
                  onClick={() => {
                    if (plan.id !== currentPlanId) {
                      const isDowngrade =
                        getTierRank(plan.id) < getTierRank(currentPlanId);
                      if (isDowngrade) {
                        void cancelSubscription(plan.id);
                      } else {
                        void startCheckout(plan.id);
                      }
                    }
                  }}
                >
                  {pendingPlanId === plan.id ? "processing..." : getCta(plan.id, currentPlanId)}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {error ? (
        <p className="text-center text-xs text-red-500">{error}</p>
      ) : null}

      {notice ? (
        <p className="text-center text-xs text-ink-muted">{notice}</p>
      ) : null}

      <div className="text-center text-xs text-ink-muted lowercase">
        {billing.waitlistNote}
      </div>
    </>
  );
}
