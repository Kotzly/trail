import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { LayoutGrid, Palette, Share2, Sparkles, Wand2 } from "lucide-react";
import { marketingCopy } from "@trail/content";
import { cn } from "@trail/ui";

const iconMap = {
  palette: Palette,
  layout: LayoutGrid,
  share: Share2,
  sparkles: Sparkles,
  wand: Wand2
};

export function PersonalizationSection() {
  const { personalization } = marketingCopy;

  return (
    <section id="make-trail-yours" className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 reveal">
          <span className="trail-eyebrow text-ink-subtle">
            {personalization.eyebrow}
          </span>
          <h2 className="trail-title">{personalization.title}</h2>
          <p className="trail-copy max-w-2xl">{personalization.summary}</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)]">
          <GlowingGrid cards={personalization.cards} />
        </div>
      </div>
    </section>
  );
}

function GlowingGrid({
  cards
}: {
  cards: ReadonlyArray<{
    title: string;
    description: string;
    icon: keyof typeof iconMap;
    layout: string;
  }>;
}) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-12 md:grid-rows-3 xl:grid-rows-2">
      {cards.map((card, index) => {
        const Icon = iconMap[card.icon] ?? Sparkles;
        return (
          <GridItem
            key={card.title}
            area={card.layout}
            icon={<Icon className="h-4 w-4" />}
            title={card.title}
            description={card.description}
            delay={index * 0.08}
          />
        );
      })}
    </ul>
  );
}

function VideoColumn({
  items,
  align = "left"
}: {
  items: ReadonlyArray<{
    title: string;
    description: string;
    type: "image" | "video";
    src: string;
    alt: string;
  }>;
  align?: "left" | "right";
}) {
  return (
    <div className="flex flex-col gap-6">
      {items.map((item, index) => (
        <figure
          key={item.title}
          className={cn(
            "overflow-hidden rounded-3xl border border-border/60 bg-surface reveal",
            align === "right" && "lg:ml-auto"
          )}
          style={{ "--reveal-delay": `${index * 0.08}s` } as CSSProperties}
        >
          <div className="relative aspect-video w-full">
            {item.type === "video" ? (
              <video
                className="h-full w-full object-cover"
                loop
                muted
                playsInline
                preload="metadata"
                poster="/assets/video-poster-white.jpg"
                data-play-on-view="true"
                aria-label={item.title}
              >
                <source src={item.src} type="video/mp4" />
              </video>
            ) : (
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="(min-width: 1024px) 420px, 100vw"
                className="object-cover"
              />
            )}
          </div>
          <figcaption className="space-y-1 p-4">
            <p className="text-sm font-semibold text-ink">{item.title}</p>
            <p className="text-xs text-ink-subtle">{item.description}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

interface GridItemProps {
  area: string;
  icon: ReactNode;
  title: string;
  description: ReactNode;
  delay?: number;
}

const GridItem = ({ area, icon, title, description, delay = 0 }: GridItemProps) => {
  return (
    <li
      className={cn("min-h-[13rem] list-none reveal", area)}
      style={{ "--reveal-delay": `${delay}s` } as CSSProperties}
    >
      <div className="relative h-full rounded-[1.25rem] border border-border/60 p-2 md:rounded-[1.5rem] md:p-3">
        <div className="relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-xl border border-border/60 bg-surface p-6">
          <div className="relative flex flex-1 flex-col justify-between gap-3">
            <div className="w-fit rounded-lg border border-border/60 bg-surface-high p-2 text-ink">
              {icon}
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-ink md:text-2xl">
                {title}
              </h3>
              <p className="text-sm text-ink-muted">{description}</p>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};
