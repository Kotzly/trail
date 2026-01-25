import { marketingCopy } from "@trail/content";
import { Badge } from "@trail/ui";

export function MarketingHero() {
  const { hero } = marketingCopy;

  return (
    <section className="relative overflow-hidden px-6 pb-12 pt-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-16 h-40 w-40 rounded-full bg-ink/5 blur-3xl" />
        <div className="absolute -right-10 top-40 h-56 w-56 rounded-full bg-ink/10 blur-3xl float-slow" />
        <div className="absolute bottom-10 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-ink/5 blur-3xl float-slower" />
      </div>
      <div className="mx-auto max-w-6xl text-center">
        <div className="space-y-6">
          <Badge className="border border-stroke/40 bg-surface/70 text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">
            {hero.pill}
          </Badge>
          <h1 className="font-display text-4xl font-semibold leading-tight text-ink md:text-6xl">
            <span className="block text-ink-muted">{hero.lead}</span>
            <span className="mt-2 flex justify-center text-ink">
              <span className="word-rotator">
                <span className="word-rotator-track">
                  {hero.words.map((word) => (
                    <span key={word}>{word}</span>
                  ))}
                </span>
              </span>
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-ink-subtle">{hero.summary}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://my.gettrail.net"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-surface shadow-card transition hover:bg-ink-muted"
            >
              {hero.ctaPrimary}
            </a>
            <a
              href="#workflow"
              className="inline-flex items-center gap-2 rounded-full border border-stroke/60 px-6 py-3 text-sm font-semibold text-ink transition hover:border-stroke"
            >
              {hero.ctaSecondary}
            </a>
          </div>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {marketingCopy.stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-stroke/40 bg-surface/80 p-4 text-left">
              <div className="text-2xl font-semibold text-ink">{stat.value}</div>
              <div className="mt-1 text-xs text-ink-subtle">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
