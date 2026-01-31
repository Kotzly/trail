import { marketingCopy } from "@trail/content";
import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "../components/ui/accordion";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "Trail FAQ — Privacy, data, and sharing",
  description:
    "Answers about what data is saved, how sharing works, supported browsers, and how to keep work private while you research.",
  path: "/faq"
});

export default function FaqPage() {
  const { faq } = marketingCopy;

  return (
    <div className="flex min-h-screen flex-col bg-base text-ink">
      <MarketingNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-20">
        <div className="flex flex-col gap-4">
          <span className="trail-eyebrow text-ink-subtle">FAQ</span>
          <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">{faq.title}</h1>
          <p className="text-sm text-ink-subtle">Everything you need to know about Trail today.</p>
        </div>
        <div className="mt-12">
          <h2 className="sr-only">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="space-y-3">
            {faq.items.map((item) => (
              <AccordionItem
                key={item.question}
                value={item.question}
                className="rounded-3xl border border-stroke/40 bg-surface px-6 py-2"
              >
                <AccordionTrigger className="text-base text-ink">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-ink-subtle">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <section className="mt-16 rounded-3xl border border-stroke/40 bg-surface/70 p-8">
          <h2 className="text-2xl font-semibold text-ink">How Trail handles your data</h2>
          <div className="mt-4 space-y-4 text-sm text-ink-muted">
            <p>
              This product is designed for teams who need trustworthy source tracking without
              sacrificing privacy. Each saved path keeps a clean record of where a decision
              came from, while staying lightweight enough for daily research and writing
              sessions.
            </p>
            <p>
              We only store the basics required to rebuild a path: URLs, page titles,
              timestamps, and the notes you write. We do not capture page content,
              cookies, or form inputs. Saved paths stay private by default and can be shared
              only when you decide to invite a teammate or generate a link.
            </p>
            <p>
              Syncing is opt-in and transparent. You can keep personal paths local,
              switch off sync at any time, and export your data when you need to move
              it elsewhere. If you ever have a question, support can walk you through
              what is stored and how to delete it.
            </p>
            <p>
              For teams, the workspace keeps collaboration predictable. Shared paths show who
              added a source, when it was captured, and which notes or decisions were
              attached. When you export, you get a clean timeline that works for
              reports, docs, and research briefs without any extra cleanup.
            </p>
          </div>
          <ul className="mt-6 grid gap-3 text-sm text-ink">
            <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-3">
              Private by default: sharing requires an explicit action.
            </li>
            <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-3">
              Capture the path, not the page content or cookies.
            </li>
            <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-3">
              Exports include titles, URLs, timestamps, and your notes.
            </li>
            <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-3">
              Browser support focuses on Chromium builds today, with more coming.
            </li>
          </ul>
          <p className="mt-6 text-sm text-ink-muted">
            If you need a deeper security or compliance review, reach out to support
            and we will share the latest documentation, data handling details, and
            roadmap notes relevant to your team.
          </p>
        </section>
        <section className="mt-16 rounded-3xl border border-stroke/40 bg-surface/70 p-8">
          <h2 className="text-2xl font-semibold text-ink">Tips for getting the most out of capture</h2>
          <div className="mt-4 space-y-4 text-sm text-ink-muted">
            <p>
              Start a new path when you shift topics. Keeping a single focus per path
              makes exports clearer and makes it easier for teammates to follow your
              reasoning later.
            </p>
            <p>
              If you are working in short bursts, use quick notes to mark decisions or
              next steps. Notes are searchable and travel with your shared link.
            </p>
            <p>
              When you share, add a short context block at the top of the export. It
              helps readers understand the scope of the research before they dive into
              the sources.
            </p>
          </div>
          <ul className="mt-6 grid gap-3 text-sm text-ink">
            <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-3">
              Create separate paths for each client or project.
            </li>
            <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-3">
              Use tags or short labels to make search results easier to scan.
            </li>
            <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-3">
              Export after each milestone so summaries stay lightweight.
            </li>
          </ul>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
