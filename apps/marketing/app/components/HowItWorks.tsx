import { marketingCopy } from "@trail/content";
import { Card, SectionHeading } from "@trail/ui";

export function HowItWorks() {
  const { howItWorks } = marketingCopy;

  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading
        kicker="Flow"
        title={howItWorks.title}
        subtitle="From capture to recall, Trail keeps every step visible."
      />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {howItWorks.steps.map((step, index) => (
          <Card key={step.title} className="bg-surface-low/80">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">
              Step 0{index + 1}
            </p>
            <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm text-ink-muted">{step.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
