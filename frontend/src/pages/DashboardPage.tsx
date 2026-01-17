import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { BadgeCheck, CalendarClock, CreditCard, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const token = accessToken ?? "";
  const [actionError, setActionError] = useState<string | null>(null);

  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: api.getPlans });
  const subQuery = useQuery({
    queryKey: ["subscription"],
    queryFn: () => api.getSubscription(token),
    enabled: Boolean(token),
  });
  const billingQuery = useQuery({
    queryKey: ["billing"],
    queryFn: () => api.getBilling(token),
    enabled: Boolean(token),
  });

  const activePlan = useMemo(() => {
    if (!plansQuery.data || !subQuery.data) return undefined;
    return plansQuery.data.find((plan) => plan.id === subQuery.data?.planId);
  }, [plansQuery.data, subQuery.data]);

  const upgradePlan = useMemo(() => {
    if (!plansQuery.data) return undefined;
    return plansQuery.data.find((plan) => plan.tier !== "free") ?? plansQuery.data[0];
  }, [plansQuery.data]);

  const handleCheckout = async () => {
    if (!upgradePlan) return;
    setActionError(null);
    try {
      const link = await api.checkout(token, {
        planId: upgradePlan.id,
        interval: "month",
      });
      window.open(link.url, "_blank", "noopener,noreferrer");
    } catch {
      setActionError(t("dashboard.errors.checkoutFailed"));
    }
  };

  const handleCancel = async () => {
    setActionError(null);
    try {
      await api.cancelSubscription(token);
      await queryClient.invalidateQueries({ queryKey: ["subscription"] });
    } catch {
      setActionError(t("dashboard.errors.cancelFailed"));
    }
  };

  const handlePortal = async () => {
    setActionError(null);
    try {
      const link = await api.billingPortal(token);
      window.open(link.url, "_blank", "noopener,noreferrer");
    } catch {
      setActionError(t("dashboard.errors.portalFailed"));
    }
  };

  const displayName = user?.displayName?.trim();

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-stroke/40 bg-surface/80 p-8 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-3xl font-semibold">
                {displayName ? t("dashboard.welcome", { name: displayName }) : t("dashboard.welcomeGeneric")}
              </h1>
              <p className="mt-2 text-sm text-ink-subtle">{user?.email}</p>
            </div>
            <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink">{activePlan?.tier ?? "free"}</span>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-stroke/40 bg-base/50 p-4">
              <div className="text-xs text-ink-subtle">{t("dashboard.subscriptionStatus")}</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                <BadgeCheck className="h-4 w-4 text-ink" />
                {subQuery.data?.status ?? "inactive"}
              </div>
            </div>
            <div className="rounded-2xl border border-stroke/40 bg-base/50 p-4">
              <div className="text-xs text-ink-subtle">{t("dashboard.billingState")}</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                <CreditCard className="h-4 w-4 text-ink" />
                {billingQuery.data?.state ?? "none"}
              </div>
            </div>
            <div className="rounded-2xl border border-stroke/40 bg-base/50 p-4">
              <div className="text-xs text-ink-subtle">{t("dashboard.currentPeriod")}</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-ink" />
                {subQuery.data?.currentPeriodEnd
                  ? new Date(subQuery.data.currentPeriodEnd).toLocaleDateString()
                  : "--"}
              </div>
            </div>
          </div>
          {actionError && (
            <div className="mt-4 rounded-2xl border border-ink/20 bg-ink/10 px-4 py-3 text-xs text-ink">
              {actionError}
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleCheckout}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-surface"
            >
              <Sparkles className="h-4 w-4" />
              {t("dashboard.upgrade")}
            </button>
            <button
              onClick={handlePortal}
              className="rounded-full border border-stroke/60 px-5 py-2 text-sm font-semibold text-ink transition hover:border-stroke"
            >
              {t("dashboard.manageBilling")}
            </button>
            <button
              onClick={handleCancel}
              className="rounded-full border border-stroke/60 px-5 py-2 text-sm font-semibold text-ink transition hover:border-stroke"
            >
              {t("dashboard.cancelSubscription")}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-stroke/40 bg-ink p-6 text-surface shadow-card">
          <h2 className="font-display text-2xl font-semibold">{t("dashboard.nextBestPlan")}</h2>
          <p className="mt-2 text-sm text-surface/70">
            {upgradePlan ? t("dashboard.upgradeCopy", { plan: upgradePlan.name }) : t("dashboard.plansLoading")}
          </p>
          {upgradePlan && (
            <div className="mt-6 rounded-2xl border border-surface/20 bg-surface/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-surface/60">{t("dashboard.monthly")}</div>
              <div className="text-3xl font-semibold">${upgradePlan.priceMonthly.toFixed(2)}</div>
              <div className="mt-3 text-xs text-surface/60">{t("dashboard.includes")}</div>
              <ul className="mt-3 space-y-2 text-sm">
                {upgradePlan.features.slice(0, 3).map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
