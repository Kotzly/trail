import type { ReactNode } from "react";
import Image from "next/image";
import {
  Grid3X3,
  Search,
  Share2,
  Sparkles,
  Timer
} from "lucide-react";
import { marketingCopy } from "@trail/content";
import { BentoCard, BentoGrid } from "../ui/bento-grid";

const iconMap = {
  capture: Timer,
  views: Grid3X3,
  search: Search,
  share: Share2,
  polish: Sparkles
};

const backgroundAssets: Record<
  string,
  {
    src: string;
    alt: string;
    priority?: boolean;
  }
> = {
  capture: {
    src: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=420&q=60",
    alt: "Developer workstation with code on screen",
    priority: true
  },
  views: {
    src: "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=420&q=60",
    alt: "Notebook with charts and organized notes",
    priority: true
  },
  search: {
    src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=420&q=60",
    alt: "Desk setup with laptop and focused workspace",
    priority: true
  },
  share: {
    src: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=420&q=60",
    alt: "Team collaboration around shared work"
  },
  polish: {
    src: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=420&q=60",
    alt: "Meeting table prepared for strategy session"
  }
};

const imageBaseProps = {
  width: 720,
  height: 720,
  quality: 60,
  sizes: "(min-width: 1024px) 420px, (min-width: 640px) 50vw, 100vw"
} as const;

const backgrounds: Record<string, ReactNode> = Object.fromEntries(
  Object.entries(backgroundAssets).map(([key, value]) => [
    key,
    (
      <Image
        className="absolute inset-0 h-full w-full object-cover opacity-35"
        src={value.src}
        alt={value.alt}
        priority={value.priority}
        fetchPriority={value.priority ? "high" : "auto"}
        {...imageBaseProps}
      />
    )
  ])
) as Record<string, ReactNode>;

export function BentoFeatures() {
  const { features } = marketingCopy;

  return (
    <section id="features" className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4">
          <span className="trail-eyebrow">{features.eyebrow}</span>
          <p className="trail-copy max-w-2xl">{features.summary}</p>
        </div>

        <div className="mt-10">
          <BentoGrid className="lg:grid-rows-3">
            {features.items.map((feature) => {
              const Icon =
                iconMap[feature.id as keyof typeof iconMap] || Sparkles;
              const { id, ...card } = feature;
              const background = backgrounds[id] ?? backgrounds.capture;
              return (
                <BentoCard
                  key={feature.name}
                  {...card}
                  Icon={Icon}
                  background={background}
                />
              );
            })}
          </BentoGrid>
        </div>
      </div>
    </section>
  );
}
