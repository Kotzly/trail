import { marketingCopy } from "@trail/content";

export function Showcase() {
  const { showcase } = marketingCopy;

  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">
        Showcase
      </p>
      <h2 className="mt-4 font-display text-3xl font-semibold text-ink md:text-4xl">
        {showcase.title}
      </h2>
      <p className="mt-4 max-w-2xl text-sm text-ink-subtle">{showcase.subtitle}</p>
      <div className="mt-10 w-full max-w-4xl rounded-3xl border border-stroke/40 bg-surface/90 p-3 shadow-card">
        <div className="overflow-hidden rounded-2xl border border-stroke/30 bg-base/40">
          <img
            src="/showcase.gif"
            alt="Trail extension showcase"
            className="h-auto w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}
