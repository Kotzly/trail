import type { Metadata } from "next";
import Link from "next/link";

import { marketingCopy } from "@trail/content";
import { BackgroundArt, Badge, Button, Card, cn } from "@trail/ui";

import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";

export const metadata: Metadata = {
  title: marketingCopy.support.meta.title,
  description: marketingCopy.support.meta.description,
};

function buildMailto(email: string, subject: string, body?: string) {
  const params = new URLSearchParams({ subject });
  if (body) {
    params.set("body", body);
  }
  return `mailto:${email}?${params.toString()}`;
}

export default function SupportPage() {
  const { support, faq } = marketingCopy;
  const supportTemplate = [
    "Account email:",
    "Browser + version:",
    "Extension version:",
    "What happened:",
    "What you expected:",
    "Steps to reproduce:",
    "",
    "Optional: screenshot / short recording / trail link"
  ].join("\n");
  const featureTemplate = [
    "What problem are you solving?",
    "",
    "Your ideal flow:",
    "",
    "Workarounds you tried:",
    "",
    "How often you need this:",
    "",
    "Anything else (links / screenshots):"
  ].join("\n");
  const supportMailHref = buildMailto(support.email, "Trail support", supportTemplate);
  const featureMailHref = buildMailto(support.email, "Trail feature request", featureTemplate);

  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className="relative overflow-hidden">
        <BackgroundArt variant="signal" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-14 h-40 w-40 rounded-full bg-ink/5 blur-3xl float-slow" />
          <div className="absolute right-10 top-28 h-56 w-56 rounded-full bg-ink/10 blur-3xl float-slower" />
          <div className="absolute bottom-12 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-ink/5 blur-3xl float-slow" />
        </div>

        <section className="relative mx-auto max-w-7xl px-6 pb-16 pt-12">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <Badge className="trail-eyebrow border border-stroke/40 bg-surface/70">
                {support.eyebrow}
              </Badge>
              <div className="space-y-3">
                <h1 className="font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
                  {support.title}
                </h1>
                <p className="max-w-2xl text-[1rem] text-ink-muted">{support.subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href={supportMailHref}>{support.actions.email}</a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href={featureMailHref}>{support.actions.featureRequest}</a>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <Link href="/faq">{support.actions.faq}</Link>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <a href={support.actions.signInHref}>{support.actions.signIn}</a>
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="trail-card">
                  <p className="trail-eyebrow">Fastest route</p>
                  <p className="trail-copy mt-2">
                    Email{" "}
                    <a className="font-semibold text-ink underline underline-offset-4" href={supportMailHref}>
                      {support.email}
                    </a>{" "}
                    with a few details. We read every message.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-subtle">
                    <span className="rounded-full border border-stroke/50 bg-surface/70 px-3 py-1">
                      sign-in
                    </span>
                    <span className="rounded-full border border-stroke/50 bg-surface/70 px-3 py-1">
                      extension
                    </span>
                    <span className="rounded-full border border-stroke/50 bg-surface/70 px-3 py-1">
                      sharing
                    </span>
                  </div>
                </Card>
                <Card className="trail-card">
                  <p className="trail-eyebrow">Extension help</p>
                  <p className="trail-copy mt-2">
                    If something looks off in the capture flow, grab the latest build and check supported browsers.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-4">
                    <Link href="/downloads">{support.actions.downloads}</Link>
                  </Button>
                </Card>
                <Card className="trail-card sm:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="trail-eyebrow">{support.featureRequest.title}</p>
                      <p className="trail-copy mt-2">{support.featureRequest.subtitle}</p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <a href={featureMailHref}>{support.actions.featureRequest}</a>
                    </Button>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {support.featureRequest.include.slice(0, 4).map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-stroke/50 bg-surface/70 px-4 py-3 text-xs text-ink-subtle"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            <div className="space-y-6">
              <Card className="trail-panel p-6">
                <p className="trail-eyebrow">{support.includeTitle}</p>
                <ul className="mt-5 space-y-2 text-sm text-ink-muted">
                  {support.include.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-ink/60" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-3xl border border-stroke/50 bg-surface/70 p-5">
                  <p className="trail-eyebrow">Copy-paste template</p>
                  <pre className="mt-3 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-ink-subtle">
                    {supportTemplate}
                  </pre>
                </div>
              </Card>

              <Card className="trail-card-neutral p-6">
                <p className="trail-eyebrow">{support.quickChecksTitle}</p>
                <div className="mt-5 space-y-4">
                  {support.quickChecks.map((step, index) => (
                    <div
                      key={step}
                      className={cn("trail-step flex items-start gap-4", index === 0 ? "border-ink/20" : null)}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-surface">
                        {index + 1}
                      </div>
                      <p className="trail-copy mt-1 text-xs">{step}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <Card className="trail-panel p-6">
              <p className="trail-eyebrow">{support.faqTitle}</p>
              <div className="mt-5 space-y-3">
                {faq.items.slice(0, 3).map((item) => (
                  <details key={item.question} className="rounded-2xl border border-stroke/50 bg-surface/70 px-5 py-4">
                    <summary className="cursor-pointer list-none font-display text-sm font-semibold text-ink">
                      {item.question}
                    </summary>
                    <p className="trail-copy mt-2 text-xs">{item.answer}</p>
                  </details>
                ))}
              </div>
              <p className="mt-5 text-xs text-ink-subtle">{support.faqNote}</p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/faq">{support.faqCta}</Link>
              </Button>
            </Card>

            <Card className="trail-card p-7">
              <p className="trail-eyebrow">Still stuck?</p>
              <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
                Tell us the story of your trail.
              </h2>
              <p className="trail-copy mt-3 max-w-2xl">
                We are fastest when we can reproduce the issue. Send the template + any screenshot or trail link.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <a href={supportMailHref}>Email support</a>
                </Button>
                <Button asChild variant="ghost">
                  <a href={support.actions.signInHref}>Open account</a>
                </Button>
              </div>
            </Card>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
