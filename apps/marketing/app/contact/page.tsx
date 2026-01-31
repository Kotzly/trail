import Link from "next/link";
import { BackgroundArt, Button } from "@trail/ui";
import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "Contact Trail — Support and partnerships",
  description:
    "Reach Trail support, share feedback, or discuss partnerships. We respond within one business day with clear next steps for every request.",
  path: "/contact"
});

export const dynamic = "force-static";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className="relative overflow-hidden">
        <BackgroundArt variant="topography" />
        <section className="mx-auto max-w-5xl px-6 pb-16 pt-16">
          <div className="max-w-3xl">
            <p className="trail-eyebrow text-ink-subtle">Contact</p>
            <h1 className="mt-4 font-display text-4xl font-semibold text-ink md:text-5xl">
              Talk to the team
            </h1>
            <p className="mt-4 text-sm text-ink-muted">
              Send product feedback, request onboarding help, or ask about partnerships.
              We typically respond within one business day.
            </p>
            <p className="mt-4 text-sm text-ink-muted">
              The more context you can share, the better. We read every message and
              route it to the right owner so you get a clear, actionable next step.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-stroke/40 bg-surface/70 p-6">
              <h2 className="text-xl font-semibold text-ink">Support</h2>
              <p className="mt-3 text-sm text-ink-muted">
                For troubleshooting or account issues, email us and include a short
                summary plus any relevant screenshots.
              </p>
              <Button.AsChild variant="outline" size="sm" className="mt-4">
                <a href="mailto:support@gettrail.net">support@gettrail.net</a>
              </Button.AsChild>
            </div>
            <div className="rounded-3xl border border-stroke/40 bg-surface/70 p-6">
              <h2 className="text-xl font-semibold text-ink">Sales & partnerships</h2>
              <p className="mt-3 text-sm text-ink-muted">
                For team rollouts, pilots, or partnerships, share a few details about
                your timeline and goals so we can respond quickly.
              </p>
              <Button.AsChild variant="outline" size="sm" className="mt-4">
                <a href="mailto:hello@gettrail.net">hello@gettrail.net</a>
              </Button.AsChild>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-stroke/40 bg-surface/70 p-6">
              <h2 className="text-xl font-semibold text-ink">Security & privacy</h2>
              <p className="mt-3 text-sm text-ink-muted">
                If you need a security review, data handling details, or privacy
                documentation, send us a note and we will share the latest materials
                and answer any vendor questions. We can also complete standard
                security questionnaires on request.
              </p>
              <Button.AsChild variant="outline" size="sm" className="mt-4">
                <a href="mailto:security@gettrail.net">security@gettrail.net</a>
              </Button.AsChild>
            </div>
            <div className="rounded-3xl border border-stroke/40 bg-surface/70 p-6">
              <h2 className="text-xl font-semibold text-ink">Press & media</h2>
              <p className="mt-3 text-sm text-ink-muted">
                For media inquiries, brand assets, or founder interviews, include your
                publication and deadline so we can respond with the right materials.
                We can provide screenshots, product notes, and founder bios.
              </p>
              <Button.AsChild variant="outline" size="sm" className="mt-4">
                <a href="mailto:press@gettrail.net">press@gettrail.net</a>
              </Button.AsChild>
            </div>
          </div>

          <div className="mt-10 rounded-3xl border border-stroke/40 bg-surface/70 p-6">
            <h2 className="text-xl font-semibold text-ink">What to include</h2>
            <p className="mt-3 text-sm text-ink-muted">
              Clear context helps us respond faster. If you can, include the basics
              below so we can route your request to the right person.
            </p>
            <ul className="mt-4 grid gap-3 text-sm text-ink-muted md:grid-cols-2">
              <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-3">
                The account email tied to your workspace.
              </li>
              <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-3">
                A short description of the task or workflow you are trying to complete.
              </li>
              <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-3">
                Any relevant screenshots, recordings, or examples.
              </li>
              <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-3">
                Your preferred timeline and any deadlines to consider.
              </li>
            </ul>
          </div>

          <div className="mt-10 rounded-3xl border border-stroke/40 bg-surface/70 p-6">
            <h2 className="text-xl font-semibold text-ink">Response times</h2>
            <p className="mt-3 text-sm text-ink-muted">
              We typically respond within one business day, Monday through Friday.
              Urgent requests should be marked clearly in the subject line so we can
              prioritize them appropriately.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              For planned rollouts or procurement cycles, send a note early so we can
              align on timelines and share any documentation you need.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              If you are blocked in a live session, mention the urgency in the subject
              line and we will do our best to accelerate the response.
            </p>
          </div>

          <div className="mt-10 rounded-3xl border border-stroke/40 bg-surface/70 p-6">
            <h2 className="text-xl font-semibold text-ink">Helpful links</h2>
            <p className="mt-3 text-sm text-ink-muted">
              Looking for documentation or quick answers? Start with the FAQ and support
              pages for walkthroughs and common troubleshooting steps.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button.AsChild variant="outline" size="sm">
                <Link href="/faq">FAQ</Link>
              </Button.AsChild>
              <Button.AsChild variant="outline" size="sm">
                <Link href="/support">Support</Link>
              </Button.AsChild>
              <Button.AsChild variant="outline" size="sm">
                <Link href="/downloads">Downloads</Link>
              </Button.AsChild>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
