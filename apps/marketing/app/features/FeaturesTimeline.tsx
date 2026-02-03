"use client";

import { Timeline, TimelineItem } from "../components/ui/timeline";
import roadmapData from "../data/roadmap.json";

export function FeaturesTimeline() {
  const items = roadmapData.items as unknown as TimelineItem[];
  
  return (
    <section className="relative px-6 py-24">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            {roadmapData.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-ink-muted">
            {roadmapData.subtitle}
          </p>
        </div>

        <Timeline items={items} />
      </div>
    </section>
  );
}
