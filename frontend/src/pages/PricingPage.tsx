import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function PricingPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["plans"],
    queryFn: api.getPlans,
  });

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-col gap-4 text-center">
        <h1 className="font-display text-4xl font-semibold text-ink">{t("pricing.title")}</h1>
        <p className="text-sm text-ink-subtle">{t("pricing.subtitle")}</p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {isLoading &&
          [0, 1].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl bg-surface/80" />
          ))}

        {isError && <div className="text-center text-sm text-ink">{t("pricing.loadingError")}</div>}

        {data?.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-3xl border ${plan.highlight ? "border-ink/50 bg-ink text-surface" : "border-stroke/40 bg-surface/90"} p-6 shadow-card`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-2xl font-semibold capitalize">{plan.name}</h3>
                <p className={`mt-2 text-xs ${plan.highlight ? "text-surface/70" : "text-ink-subtle"}`}>
                  {plan.tier}
                </p>
              </div>
              {plan.highlight && (
                <span className="rounded-full bg-surface/15 px-3 py-1 text-xs uppercase tracking-[0.2em]">
                  {t("pricing.popular")}
                </span>
              )}
            </div>
            <div className="mt-6 text-3xl font-semibold">
              ${plan.priceMonthly.toFixed(2)}
              <span className={`text-xs ${plan.highlight ? "text-surface/70" : "text-ink-subtle"}`}>
                {t("pricing.perMonth")}
              </span>
            </div>
            <div className={`mt-2 text-xs ${plan.highlight ? "text-surface/60" : "text-ink-subtle"}`}>
              {t("pricing.billedYearly", { price: `$${plan.priceYearly.toFixed(2)}` })}
            </div>
            <ul className="mt-6 space-y-3 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-ink" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              to="/register"
              className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition ${
                plan.highlight
                  ? "bg-surface text-ink hover:bg-surface/90"
                  : "border border-stroke/60 text-ink hover:border-stroke"
              }`}
            >
              {t("pricing.choosePlan", { name: plan.name })}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
