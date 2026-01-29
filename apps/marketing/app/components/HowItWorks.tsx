import type { CSSProperties } from "react";

import { marketingCopy } from "@trail/content";

export function HowItWorks() {
  const { workflow } = marketingCopy;

  return (
    <section id="workflow" className="relative">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-3xl">
          <span className="trail-eyebrow">{workflow.eyebrow}</span>
          <h2 className="trail-title mt-4">{workflow.title}</h2>
          <p className="trail-copy mt-4">{workflow.summary}</p>
        </div>
        <div className="mt-12 space-y-8">
          {workflow.steps.map((step, index) => (
            <div
              key={step.title}
              className="grid gap-6 md:grid-cols-[auto_1fr] reveal"
              style={{ "--reveal-delay": `${index * 0.08}s` } as CSSProperties}
            >
              <div className="flex flex-col items-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-sm font-semibold text-surface">
                  {index + 1}
                </span>
                {index < workflow.steps.length - 1 ? (
                  <span className="mt-3 h-full w-px bg-stroke/40" aria-hidden="true" />
                ) : null}
              </div>
              <div className="rounded-3xl border border-stroke/30 bg-surface/60 p-6 shadow-elev-1 backdrop-blur-sm">
                <h3 className="font-display text-xl font-semibold text-ink">{step.title}</h3>
                <p className="trail-copy mt-2">{step.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
