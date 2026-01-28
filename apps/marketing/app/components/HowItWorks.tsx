import { marketingCopy } from "@trail/content";

export function HowItWorks() {
  const { workflow } = marketingCopy;

  return (
    <section id="workflow" className="bg-base/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="trail-eyebrow">{workflow.eyebrow}</span>
            <h2 className="trail-title mt-4">{workflow.title}</h2>
            <p className="trail-copy mt-4 max-w-xl">{workflow.summary}</p>
          </div>
          <div className="trail-card p-6">
            <div className="space-y-5">
              {workflow.steps.map((step, index) => (
                <div key={step.title} className="border-b border-stroke/30 pb-4 last:border-b-0">
                  <p className="trail-overline">Step {index + 1}</p>
                  <h3 className="mt-3 font-display text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="trail-copy mt-2">{step.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
