import type { Metadata } from "next";
import { marketingCopy } from "@trail/content";
import { BackgroundArt, Badge, Button, Card, WaitlistDialog } from "@trail/ui";
import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";

export const metadata: Metadata = {
  title: marketingCopy.downloads.meta.title,
  description: marketingCopy.downloads.meta.description,
};

export default function DownloadsPage() {
  const { downloads } = marketingCopy;

  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className="relative overflow-hidden">
        <BackgroundArt variant="graph" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-12 top-16 h-32 w-32 rounded-full bg-ink/5 blur-3xl float-slow" />
          <div className="absolute right-10 top-24 h-40 w-40 rounded-full bg-ink/10 blur-3xl float-slower" />
          <div className="absolute bottom-12 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-ink/5 blur-3xl float-slow" />
        </div>
        <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-16">
          <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-8">
              <Badge className="trail-eyebrow border border-stroke/40 bg-surface/70">
                {downloads.eyebrow}
              </Badge>
              <div className="space-y-4">
                <h1 className="font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
                  {downloads.title}
                </h1>
                <p className="max-w-2xl text-[1rem] text-ink-subtle">{downloads.subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <WaitlistDialog
                  triggerLabel={downloads.primaryCta}
                  title="Get the download link"
                  description="Share your email and we will send the extension link as soon as it lands."
                  source="downloads"
                  buttonSize="lg"
                />
                <Button asChild variant="outline" size="lg">
                  <a href="https://my.gettrail.net/auth/login">{downloads.secondaryCta}</a>
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {downloads.cards.map((card) => (
                  <Card
                    key={card.title}
                    className="trail-card p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="trail-eyebrow">{card.title}</p>
                      <span className="trail-status">
                        {card.status}
                      </span>
                    </div>
                    <p className="trail-copy mt-3">{card.copy}</p>
                  </Card>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <Card className="trail-panel p-7">
                <p className="trail-eyebrow">{downloads.stepsTitle}</p>
                <div className="mt-5 space-y-4">
                  {downloads.steps.map((step, index) => (
                    <div
                      key={step.title}
                      className="trail-step flex items-start gap-4"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-surface">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">{step.title}</p>
                        <p className="trail-copy mt-1 text-xs">{step.copy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="trail-card-neutral p-6">
                <p className="trail-eyebrow">{downloads.noteTitle}</p>
                <p className="trail-copy mt-2">{downloads.noteCopy}</p>
              </Card>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
