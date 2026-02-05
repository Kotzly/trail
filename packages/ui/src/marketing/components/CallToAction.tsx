import Link from "next/link";
import { ArrowRight } from "../../icons";
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
        <div className="mt-8">
          <Link
            href="/downloads"
            className="inline-flex items-center gap-2 rounded-full bg-cta px-6 py-3 text-sm font-semibold text-cta-fg transition hover:bg-cta-hover"
          >
            {cta.primary}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {cta.note ? (
          <p className="mt-4 text-xs text-ink-subtle">{cta.note}</p>
        ) : null}
      </div>
    </section>
  );
}
