import Link from "next/link";
import { marketingCopy } from "@trail/content";
import { InteractiveHoverButton } from "./ui/interactive-hover-button";

export function CallToAction() {
  const { cta } = marketingCopy;

  return (
    <section className="relative px-6 py-20 reveal">
      <div className="absolute inset-0 -z-10 bg-surface/40" />
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          {cta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[1rem] text-ink-muted">
          {cta.subtitle}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <InteractiveHoverButton
            href="/downloads"
            text={cta.primary}
            className="bg-ink text-[color:rgb(var(--cta-fg))] hover:bg-ink-muted"
          />
          <Link
            href="https://app.gettrail.net/auth/login"
            className="inline-flex items-center gap-2 rounded-full border border-stroke/60 px-6 py-3 text-sm font-semibold text-ink transition hover:border-stroke"
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
