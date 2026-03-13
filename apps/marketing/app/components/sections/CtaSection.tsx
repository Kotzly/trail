"use client";

import { Reveal } from "../ui/reveal";
import { parseHeadline } from "../ui/parse-headline";
import type { CtaSectionData } from "../../../lib/sanity/types";

export function CtaSection({ section }: { section: CtaSectionData }) {
  return (
    <section id="cta" className="relative py-24 sm:py-32">
      {/* Subtle radial gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(10,10,10,1)_0%,_rgba(0,0,0,1)_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(212,22,108,0.03)_0%,_transparent_50%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        {section.eyebrow && (
          <Reveal delay={0.1}>
            <span className="inline-flex rounded-full border border-gold/20 bg-gold-subtle px-3 py-1 text-xs tracking-label uppercase text-gold">
              {section.eyebrow}
            </span>
          </Reveal>
        )}

        {section.title && (
          <Reveal delay={0.2}>
            <h2 className="tracking-heading mt-6 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              {parseHeadline(section.title)}
            </h2>
          </Reveal>
        )}

        {section.description && (
          <Reveal delay={0.3}>
            <p className="tracking-body mx-auto mt-6 max-w-lg text-lg text-text-secondary">
              {section.description}
            </p>
          </Reveal>
        )}

        <Reveal delay={0.4}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {section.primaryCta && (
              <a
                href={section.primaryCta.href}
                className="inline-flex rounded-full bg-primary px-8 py-3 text-base font-medium text-primary-foreground transition-shadow hover:shadow-[0_0_24px_rgba(212,22,108,0.25)] active:scale-[0.98]"
              >
                {section.primaryCta.text}
              </a>
            )}
            {section.secondaryCta && (
              <a
                href={section.secondaryCta.href}
                className="inline-flex rounded-full border border-border-strong px-8 py-3 text-base font-medium text-text-secondary transition-colors hover:text-text-primary hover:border-text-tertiary"
              >
                {section.secondaryCta.text}
              </a>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
