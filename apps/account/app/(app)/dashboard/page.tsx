import Link from "next/link";
import { LightningBoltIcon } from "@radix-ui/react-icons";
import { Button, InfoBanner, StepList } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { DashboardClient } from "./DashboardClient";

export default function DashboardPage() {
  const { dashboard } = accountCopy;

  return (
    <section className="space-y-10">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-surface/85 p-8 shadow-card">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-12 top-10 h-32 w-32 rounded-full bg-ink/5 blur-3xl" />
            <div className="absolute -right-12 top-6 h-40 w-40 rounded-full bg-ink/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full bg-ink/5 blur-3xl" />
          </div>
          <div className="relative space-y-6">
            <div>
              <p className="trail-eyebrow">{dashboard.hero.eyebrow}</p>
              <h1 className="trail-title mt-3">{dashboard.hero.title}</h1>
              <p className="trail-copy mt-3 text-base">{dashboard.hero.subtitle}</p>
            </div>
            <InfoBanner
              title={dashboard.hero.bannerTitle}
              description={dashboard.hero.bannerDescription}
              icon={<LightningBoltIcon className="h-4 w-4" />}
              tone="emphasis"
            />
          </div>
        </div>

        <div className="trail-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="trail-eyebrow">{dashboard.onboarding.eyebrow}</p>
              <p className="mt-2 text-sm font-semibold text-ink">{dashboard.onboarding.title}</p>
            </div>
            <span className="trail-pill">{dashboard.onboarding.progress}</span>
          </div>
          <p className="trail-copy mt-3 text-xs">{dashboard.onboarding.subtitle}</p>
          <StepList className="mt-4" steps={dashboard.onboarding.steps} />
          <Button asChild className="mt-5 w-full" size="md">
            <Link href="/extension">{dashboard.onboarding.cta}</Link>
          </Button>
        </div>
      </div>

      <DashboardClient />
    </section>
  );
}
