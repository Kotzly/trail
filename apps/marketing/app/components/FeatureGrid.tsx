import { marketingCopy } from "@trail/content";
import { Card, SectionHeading } from "@trail/ui";

export function FeatureGrid() {
  const { highlights } = marketingCopy;

  return (
    <section id="product" className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading
        kicker="Product"
        title={highlights.title}
        subtitle="Trail borrows the clarity of the extension UI and brings it to your account."
      />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {highlights.items.map((item) => (
          <Card key={item.title} className="bg-surface/80">
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm text-ink-muted">{item.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
