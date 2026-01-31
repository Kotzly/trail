import { marketingCopy } from "@trail/content";
import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";
import { Pricing } from "../components/blocks/pricing";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "Trail Pricing — Plans for teams and solo work",
  description:
    "Compare monthly and annual plans for individuals and teams. Every plan includes exports, sharing controls, and clear data ownership.",
  path: "/pricing"
});

export default function PricingPage() {
  const { pricing } = marketingCopy;

  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className="pt-8">
        <Pricing
          plans={pricing.plans}
          title={pricing.title}
          description={pricing.description}
          eyebrow={pricing.eyebrow}
          titleAs="h1"
          toggleLabel={pricing.toggleLabel}
          toggleNote={pricing.toggleNote}
          billedMonthlyLabel={pricing.billedMonthlyLabel}
          billedAnnuallyLabel={pricing.billedAnnuallyLabel}
          popularBadge={pricing.popularBadge}
        />
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div className="rounded-3xl border border-stroke/40 bg-surface/70 p-8">
            <h2 className="text-2xl font-semibold text-ink">How to choose a plan</h2>
            <div className="mt-4 space-y-4 text-sm text-ink-muted">
              <p>
                The platform is built for individuals who need a reliable source path and
                for teams who want a shared memory of decisions. Start with the plan that
                matches your current workflow and upgrade as your collaboration needs
                grow.
              </p>
              <p>
                Annual billing saves money and keeps procurement simple, while monthly
                billing lets you test the workflow during a busy research season. Every
                plan includes core privacy controls, fast export options, and clear
                ownership of your data.
              </p>
              <p>
                For larger teams, we can provide invoicing and onboarding help. If you
                need procurement paperwork or a security review, reach out and we will
                get you the details quickly.
              </p>
              <p>
                If you are evaluating the product for a team, focus on how many shared
                paths you need and whether you want centralized admin controls. We can
                help with onboarding, team training, and migration from existing docs or
                spreadsheets.
              </p>
              <p>
                Not sure how to estimate usage? We can share a simple seat calculator and
                an onboarding checklist so your team can ramp quickly without surprises.
              </p>
              <p>
                Enterprise conversations include security and data handling documentation,
                plus a roadmap view for SSO and advanced admin controls.
              </p>
            </div>
            <ul className="mt-6 grid gap-3 text-sm text-ink">
              <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-3">
                Upgrade, downgrade, or cancel any time from your account.
              </li>
              <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-3">
                All plans include exports, sharing controls, and data portability.
              </li>
              <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-3">
                Team plans include shared spaces and collaboration support.
              </li>
            </ul>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
