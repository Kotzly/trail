import Link from "next/link";
import { BackgroundArt } from "@trail/ui";
import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "About Trail — Mission and product principles",
  description:
    "Learn why Trail exists, the principles behind the product, and how the team builds calm, privacy-first research workflows.",
  path: "/about"
});

export const dynamic = "force-static";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className="relative overflow-hidden">
        <BackgroundArt variant="signal" />
        <section className="mx-auto max-w-5xl px-6 pb-16 pt-16">
          <div className="max-w-3xl">
            <p className="trail-eyebrow text-ink-subtle">About</p>
            <h1 className="mt-4 font-display text-4xl font-semibold text-ink md:text-5xl">
              Built for calm, accountable research
            </h1>
            <p className="mt-4 text-sm text-ink-muted">
              Trail began as a way to capture research decisions without the mess of
              tab overload. We focus on clear provenance, fast capture, and shareable
              context so teams can move from evidence to decisions with confidence.
            </p>
            <p className="mt-4 text-sm text-ink-muted">
              We work with product, security, policy, and strategy teams who need to
              cite sources with confidence. A trail keeps every link, note, and decision
              visible without turning research into overhead or admin work.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-stroke/40 bg-surface/70 p-6">
              <h2 className="text-xl font-semibold text-ink">Our mission</h2>
              <p className="mt-3 text-sm text-ink-muted">
                Help knowledge workers build a reliable path from source to outcome.
                We believe research should be lightweight, repeatable, and respectful
                of privacy.
              </p>
            </div>
            <div className="rounded-3xl border border-stroke/40 bg-surface/70 p-6">
              <h2 className="text-xl font-semibold text-ink">What we value</h2>
              <p className="mt-3 text-sm text-ink-muted">
                Transparency, collaboration, and calm interfaces. The product stays out
                of the way while still providing structure, exportability, and clarity.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-3xl border border-stroke/40 bg-surface/70 p-6">
            <h2 className="text-xl font-semibold text-ink">How we build</h2>
            <p className="mt-3 text-sm text-ink-muted">
              We iterate with researchers, designers, and product teams to keep the
              workflow lightweight. Every release focuses on speed, ergonomics, and
              safe collaboration.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              We also document the decisions behind every release. That means clear
              changelogs, repeatable onboarding, and a product that feels predictable
              when a team scales up to more complex research programs.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Want to learn more or request a feature? Visit the{" "}
              <Link className="underline underline-offset-4" href="/contact">
                contact page
              </Link>{" "}
              or send a note to support.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-stroke/40 bg-surface/70 p-6">
              <h2 className="text-xl font-semibold text-ink">Principles we follow</h2>
              <ul className="mt-4 space-y-3 text-sm text-ink-muted">
                <li>
                  <span className="font-semibold text-ink">Privacy by default.</span>{" "}
                  Capture only what you need to recreate a decision, never page content.
                </li>
                <li>
                  <span className="font-semibold text-ink">Calm interfaces.</span>{" "}
                  The UI should reduce cognitive load, not add to it.
                </li>
                <li>
                  <span className="font-semibold text-ink">Portable outputs.</span>{" "}
                  Export formats should work in docs, briefs, and stakeholder updates.
                </li>
                <li>
                  <span className="font-semibold text-ink">Speed over complexity.</span>{" "}
                  We ship the smallest improvement that unlocks a clear workflow win.
                </li>
              </ul>
            </div>
            <div className="rounded-3xl border border-stroke/40 bg-surface/70 p-6">
              <h2 className="text-xl font-semibold text-ink">Where we’re heading</h2>
              <p className="mt-3 text-sm text-ink-muted">
                We’re expanding capture coverage, improving exports, and making shared
                paths easier to understand at a glance. Roadmap priorities come directly
                from feedback about real research workflows.
              </p>
              <p className="mt-3 text-sm text-ink-muted">
                If you are running a research-heavy program and need tailored onboarding,
                we can provide playbooks and training sessions for your team.
              </p>
              <p className="mt-3 text-sm text-ink-muted">
                We will also continue to deepen our privacy posture, add more admin
                controls, and make it even simpler to share a clean narrative with
                stakeholders who are not in the day-to-day research loop.
              </p>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
