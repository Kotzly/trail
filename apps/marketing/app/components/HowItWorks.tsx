import { marketingCopy } from "@trail/content";

export function HowItWorks() {
  const { workflow } = marketingCopy;

  return (
    <section id="workflow" className="bg-base/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">
              {workflow.eyebrow}
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold text-ink md:text-4xl">
              {workflow.title}
            </h2>
            <p className="mt-4 max-w-xl text-sm text-ink-subtle">{workflow.summary}</p>
          </div>
          <div className="rounded-3xl border border-stroke/40 bg-surface/90 p-6 shadow-card">
            <div className="space-y-5">
              {workflow.steps.map((step, index) => (
                <div key={step.title} className="border-b border-stroke/30 pb-4 last:border-b-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink-subtle">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-3 font-display text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm text-ink-subtle">{step.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
