import { marketingCopy } from "@trail/content";
import { Card, SectionHeading } from "@trail/ui";

export function SecuritySection() {
  const { security } = marketingCopy;

  return (
    <section id="security" className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading
        kicker="Security"
        title={security.title}
        subtitle={security.body}
      />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {security.bullets.map((item) => (
          <Card key={item} className="bg-surface/70 text-sm text-ink-muted">
            {item}
          </Card>
        ))}
      </div>
    </section>
  );
}
