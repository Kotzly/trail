import Link from "next/link";
import { marketingCopy } from "@trail/content";
import { Badge, BackgroundArt, Button, Card } from "@trail/ui";

export function MarketingHero() {
  const { hero } = marketingCopy;

  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-20">
      <BackgroundArt variant="topography" />
      <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Badge>{hero.badge}</Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            {hero.title}
          </h1>
          <p className="max-w-xl text-base text-ink-muted sm:text-lg">
            {hero.subtitle}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="#product">{hero.primaryCta}</a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="https://my.gettrail.net">{hero.secondaryCta}</Link>
            </Button>
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">
            {hero.note}
          </p>
        </div>
        <div className="grid gap-4">
          <Card className="bg-surface/90">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Trail map</p>
            <h3 className="mt-4 text-2xl font-semibold">A living map of every tab</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Watch your browsing build a graph in real time. Pin the nodes that matter.
            </p>
          </Card>
          <Card className="bg-surface-high/80">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Sync ready</p>
            <h3 className="mt-4 text-2xl font-semibold">Your account, ready when you are</h3>
            <p className="mt-2 text-sm text-ink-muted">
              The account experience is live now, with billing coming soon on Polar.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}
