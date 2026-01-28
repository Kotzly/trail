import { marketingCopy } from "@trail/content";

export function CallToAction() {
  const { cta } = marketingCopy;

  return (
    <section className="px-6 py-20">
      <div className="trail-card mx-auto max-w-6xl px-8 py-16 text-center">
        <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          {cta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[1rem] text-ink-muted">
          {cta.subtitle}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="/downloads"
            className="cta-primary inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold shadow-card transition hover:bg-ink-muted"
          >
            {cta.primary}
          </a>
          <a
            href="https://my.gettrail.net/auth/login"
            className="inline-flex items-center gap-2 rounded-full border border-stroke/60 px-6 py-3 text-sm font-semibold text-ink transition hover:border-stroke"
          >
            {cta.secondary}
          </a>
        </div>
        {cta.note ? (
          <p className="mt-4 text-xs text-ink-subtle">{cta.note}</p>
        ) : null}
      </div>
    </section>
  );
}
