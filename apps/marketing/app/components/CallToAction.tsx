import Link from "next/link";
import { marketingCopy } from "@trail/content";

export function CallToAction() {
  const { cta } = marketingCopy;

  return (
    <section className="relative px-6 py-20">
      <div className="absolute inset-0 -z-10 bg-surface" />
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          {cta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[1rem] text-ink-muted">
          {cta.subtitle}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/downloads"
            className="cta-primary inline-flex items-center gap-2 rounded-full bg-cta px-6 py-3 text-sm font-semibold text-cta-fg transition hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {cta.primary}
          </Link>
          <Link
            href="https://app.gettrail.net"
            className="inline-flex items-center gap-2 rounded-full border border-stroke/70 px-6 py-3 text-sm font-semibold text-ink transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            {cta.secondary}
          </Link>
        </div>
        {cta.note ? (
          <p className="mt-4 text-xs text-ink-subtle">{cta.note}</p>
        ) : null}
      </div>
    </section>
  );
}
