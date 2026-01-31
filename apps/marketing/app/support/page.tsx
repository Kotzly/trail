import { marketingCopy } from "@trail/content";
import { BackgroundArt } from "@trail/ui";
import { buildMetadata } from "../../lib/seo";

import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";
import { SupportFlow } from "./SupportFlow";

export const metadata = buildMetadata({
  title: "Trail Support — Help for setup, billing, and access",
  description:
    "Troubleshoot sign-in, sync, and app issues with step-by-step checks, or contact support with diagnostics for faster help.",
  path: "/support"
});

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className="relative overflow-hidden">
        <BackgroundArt variant="signal" />
        <section className="mx-auto max-w-4xl px-6 pt-16 text-center">
          <p className="trail-eyebrow text-ink-subtle">{marketingCopy.support.title}</p>
          <h1 className="mt-4 font-display text-4xl font-semibold text-ink md:text-5xl">
            Support that keeps your work moving
          </h1>
          <p className="mt-4 text-sm text-ink-muted">
            Use the guided flow below to troubleshoot the most common account and
            app issues. We cover setup, sync, account access, and device
            compatibility so you can get back to research quickly.
          </p>
          <div className="mt-6 grid gap-3 text-left text-sm text-ink-muted sm:grid-cols-2">
            <div className="rounded-2xl border border-stroke/40 bg-surface/70 p-4">
              Start with the quick checks to confirm the app is enabled and
              signed in correctly.
            </div>
            <div className="rounded-2xl border border-stroke/40 bg-surface/70 p-4">
              Billing and plan questions are handled in the flow, with links to your
              account settings when needed.
            </div>
            <div className="rounded-2xl border border-stroke/40 bg-surface/70 p-4">
              If sync looks delayed, verify connectivity and re-open the app to refresh.
            </div>
            <div className="rounded-2xl border border-stroke/40 bg-surface/70 p-4">
              Still stuck? The final step offers email support with context.
            </div>
          </div>
        </section>
      <SupportFlow />
      <section className="mx-auto max-w-4xl px-6 pb-16 pt-10">
        <h2 className="text-2xl font-semibold text-ink">What helps us resolve issues faster</h2>
        <div className="mt-4 space-y-4 text-sm text-ink-muted">
          <p>
            When you contact support, including a short summary of what you expected
            versus what actually happened speeds things up. If a path failed to sync,
            mention the approximate time and the device you were using.
          </p>
          <p>
            For app issues, share your version (Chrome / Brave / Edge) and whether you are using
            a privacy mode like Incognito. For billing or account questions, include
            the email tied to your workspace so we can locate the right account.
          </p>
          <p>
            We reply in the order tickets are received and typically respond within
            one business day. If the issue is urgent, flag it in the subject line so
            we can prioritize it.
          </p>
          <p>
            If you are reporting a bug, a quick screen recording or a copy of any error
            message is extremely helpful. It helps us reproduce the issue and confirm
            whether the fix is already in progress.
          </p>
          <p>
            We also monitor major platform updates. If something breaks after a platform
            update, let us know the version you upgraded to and whether you see the issue
            in multiple profiles or only one.
          </p>
        </div>
      </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
