import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

export default function PricingPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["plans"],
    queryFn: api.getPlans,
  });

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-col gap-4 text-center">
        <h1 className="font-display text-4xl font-semibold text-ink">Pricing built for momentum</h1>
        <p className="text-sm text-slate-600">
          Start free and upgrade to sync your browsing universe across every device.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {isLoading &&
          [0, 1].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl bg-white/70" />
          ))}

        {isError && <div className="text-center text-sm text-coral">Failed to load plans.</div>}

        {data?.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-3xl border ${plan.highlight ? "border-ink/50 bg-ink text-sand" : "border-black/5 bg-white/70"} p-6 shadow-card`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-2xl font-semibold capitalize">{plan.name}</h3>
                <p className={`mt-2 text-xs ${plan.highlight ? "text-sand/70" : "text-slate-500"}`}>
                  {plan.tier}
                </p>
              </div>
              {plan.highlight && (
                <span className="rounded-full bg-sand/15 px-3 py-1 text-xs uppercase tracking-[0.2em]">
                  Popular
                </span>
              )}
            </div>
            <div className="mt-6 text-3xl font-semibold">
              ${plan.priceMonthly.toFixed(2)}
              <span className={`text-xs ${plan.highlight ? "text-sand/70" : "text-slate-500"}`}>/mo</span>
            </div>
            <div className={`mt-2 text-xs ${plan.highlight ? "text-sand/60" : "text-slate-400"}`}>
              ${plan.priceYearly.toFixed(2)} billed yearly
            </div>
            <ul className="mt-6 space-y-3 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-moss" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              to="/register"
              className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition ${
                plan.highlight
                  ? "bg-sand text-ink hover:bg-white"
                  : "border border-ink/20 text-ink hover:border-ink/50"
              }`}
            >
              Choose {plan.name}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
