import Link from "next/link";
import { marketingCopy } from "@trail/content";
import { BackgroundArt, Button } from "@trail/ui";

export function CallToAction() {
  const { cta } = marketingCopy;

  return (
    <section className="relative overflow-hidden px-6 py-20">
      <BackgroundArt variant="circuit" className="opacity-70" />
      <div className="mx-auto max-w-6xl rounded-3xl border border-border/50 bg-surface/70 px-8 py-16 text-center shadow-elev-2">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{cta.title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-ink-muted">{cta.subtitle}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <a href="#product">{cta.primary}</a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="https://my.gettrail.net">{cta.secondary}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
