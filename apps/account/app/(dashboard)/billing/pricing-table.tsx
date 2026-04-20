"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { TrailPlanDefinition } from "@trail/content";
import type { SubscriptionSnapshot } from "@/src/server/backend/subscription-access";
import {
  createCheckout,
  cancelSubscription,
  resumeSubscription,
  openBillingPortal,
} from "./mutations";

type Interval = "month" | "year";

type PricingTableProps = {
  plans: TrailPlanDefinition[];
  snapshot: SubscriptionSnapshot | null;
};

function PlanCard({
  plan,
  snapshot,
  interval,
}: {
  plan: TrailPlanDefinition;
  snapshot: SubscriptionSnapshot | null;
  interval: Interval;
}) {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();
  const t = useTranslations("billing");
  const isCurrent = snapshot?.planId === plan.id;
  const isCurrentlyActive =
    isCurrent &&
    snapshot?.status !== "expired" &&
    snapshot?.status !== "paused";
  const isCancelPending = isCurrentlyActive && snapshot?.cancelAtPeriodEnd;
  const isFree = plan.id === "free";

  const price = interval === "year" ? plan.priceYearly : plan.priceMonthly;

  const handleUpgrade = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("planId", plan.id);
      fd.set("interval", interval);
      const result = await createCheckout({}, fd);
      if (result?.error) toast.error(result.error);
    });
  };

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelSubscription();
      if (result.error) toast.error(result.error);
      else toast.success(t("cancelAtPeriodEnd"));
    });
  };

  const handleResume = () => {
    startTransition(async () => {
      const result = await resumeSubscription();
      if (result.error) toast.error(result.error);
      else toast.success(t("toast.resumeSuccess"));
    });
  };

  const renderButton = () => {
    if (isFree) {
      if (isCurrentlyActive) {
        return (
          <Button variant="outline" className="w-full" disabled>
            {t("currentPlan")}
          </Button>
        );
      }
      return (
        <Button variant="outline" className="w-full" disabled>
          {t("downgrade")}
        </Button>
      );
    }

    if (isCurrentlyActive) {
      if (isCancelPending) {
        return (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResume}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {t("resumeSubscription")}
          </Button>
        );
      }
      return (
        <Button
          variant="outline"
          className="w-full text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
          onClick={handleCancel}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {t("cancelPlan")}
        </Button>
      );
    }

    const currentRank = snapshot?.planId
      ? ["free", "pro", "teams"].indexOf(snapshot.planId)
      : 0;
    const planRank = ["free", "pro", "teams"].indexOf(plan.id);
    const label = planRank > currentRank ? t("upgrade") : t("downgrade");

    return (
      <Button
        className="w-full"
        variant={plan.highlight ? "default" : "outline"}
        onClick={handleUpgrade}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {label}
      </Button>
    );
  };

  return (
    <Card
      className={cn(
        "flex flex-col relative",
        plan.highlight && "border-primary shadow-md",
        isCurrentlyActive && !plan.highlight && "border-muted-foreground/30",
      )}
    >
      {plan.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="px-3">{t("mostPopular")}</Badge>
        </div>
      )}
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">{plan.name}</CardTitle>
          {isCurrentlyActive && (
            <Badge
              variant={isCancelPending ? "outline" : "secondary"}
              className="text-xs"
            >
              {isCancelPending ? t("canceling") : t("current")}
            </Badge>
          )}
        </div>
        <div className="mt-2">
          <span className="text-3xl font-bold tracking-tight">
            {isFree
              ? t("free")
              : `$${interval === "year" ? Math.round(price / 12) : price}`}
          </span>
          {!isFree && (
            <span className="text-sm text-muted-foreground ml-1">
              {t("pricePerMonth")}
            </span>
          )}
          {!isFree && interval === "year" && (
            <p className="text-xs text-muted-foreground mt-1">
              {t("billedYearlyWithSave", {
                total: price,
                savings: plan.priceMonthly * 12 - price,
              })}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <Separator className="mb-4" />
        <ul className="space-y-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
          <li className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {plan.limits.maxTrees === 999
                ? t("upToTreesUnlimited")
                : t("upToTrees", { count: plan.limits.maxTrees })}
            </span>
          </li>
          <li className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {plan.limits.maxDevices === 1
                ? t("devicesOne")
                : t("devicesMany", { count: plan.limits.maxDevices })}
            </span>
          </li>
          <li className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {t("historyDays", { days: plan.limits.maxHistoryDays })}
            </span>
          </li>
        </ul>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 pt-4">
        {renderButton()}
        {isCancelPending && snapshot?.currentPeriodEnd && (
          <p className="text-xs text-muted-foreground text-center">
            {t("accessUntil", {
              date: new Date(snapshot.currentPeriodEnd).toLocaleDateString(
                locale,
                {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                },
              ),
            })}
          </p>
        )}
      </CardFooter>
    </Card>
  );
}

export function PricingTable({ plans, snapshot }: PricingTableProps) {
  const [interval, setInterval] = useState<Interval>("month");
  const [isPortalPending, startPortalTransition] = useTransition();
  const t = useTranslations("billing");

  const hasPaidPlan =
    snapshot && snapshot.planId !== "free" && snapshot.status !== "expired";

  const handleOpenPortal = () => {
    startPortalTransition(async () => {
      const result = await openBillingPortal();
      if (result?.error) toast.error(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Interval toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center rounded-lg border bg-muted p-1 gap-1">
          <button
            onClick={() => setInterval("month")}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              interval === "month"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("interval.monthly")}
          </button>
          <button
            onClick={() => setInterval("year")}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
              interval === "year"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("interval.yearly")}
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
              {t("interval.saveBadge")}
            </Badge>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            snapshot={snapshot}
            interval={interval}
          />
        ))}
      </div>

      {/* Billing portal */}
      {hasPaidPlan && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenPortal}
            disabled={isPortalPending}
            className="text-muted-foreground hover:text-foreground gap-1.5"
          >
            {isPortalPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" />
            )}
            {t("managePortal")}
          </Button>
        </div>
      )}
    </div>
  );
}
