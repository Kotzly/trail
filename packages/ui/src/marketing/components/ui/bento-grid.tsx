"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { ArrowRight } from "../../../icons";
import { cn } from "../../../utils/cn";
import { Button } from "./button";

const BentoGrid = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[22rem] grid-cols-1 gap-4 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
};

// Feature preview components
const CapturePreview = () => (
  <div className="flex items-center justify-center gap-2">
    <div className="preview-dot h-2 w-2 rounded-full bg-accent" />
    <div className="preview-dot h-2 w-2 rounded-full bg-accent/70" />
    <div className="preview-dot h-2 w-2 rounded-full bg-accent/50" />
    <svg
      className="ml-2 h-4 w-4 text-accent"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M5 12h14M12 5l7 7-7 7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

const SearchPreview = () => (
  <div className="flex items-center gap-2">
    <div className="search-ring relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent/50">
      <svg
        className="h-4 w-4 text-accent"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path
          d="m21 21-4.35-4.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
    <div className="flex items-center text-xs text-ink-muted">
      <span>find anything</span>
      <span className="search-cursor ml-0.5 inline-block h-3.5 w-0.5 bg-accent" />
    </div>
  </div>
);

const ViewsPreview = () => (
  <div className="relative flex h-12 w-12 items-center justify-center">
    <div
      className="view-shape absolute h-3 w-3 rounded bg-accent/80"
      style={{ top: "20%", left: "30%" }}
    />
    <div
      className="view-shape absolute h-3 w-3 rounded bg-accent/60"
      style={{ top: "50%", left: "60%" }}
    />
    <div
      className="view-shape absolute h-3 w-3 rounded bg-accent/40"
      style={{ top: "70%", left: "25%" }}
    />
    <svg
      className="absolute inset-0 h-full w-full text-accent/30"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <circle cx="24" cy="24" r="16" strokeDasharray="4 4" />
    </svg>
  </div>
);

const SharePreview = () => (
  <div className="share-pulse-ring relative flex h-10 w-10 items-center justify-center rounded-full">
    <svg
      className="share-icon-link h-5 w-5 text-accent"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

const ExportPreview = () => (
  <div className="flex flex-col items-center gap-1.5">
    <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-accent/50 bg-accent/10">
      <svg
        className="export-arrow h-4 w-4 text-accent"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          d="M12 5v14M5 12l7 7 7-7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
    <div className="h-1 w-16 overflow-hidden rounded-full bg-accent/20">
      <div className="export-progress-bar h-full bg-accent/60" />
    </div>
  </div>
);

const featurePreviews: Record<string, ReactNode> = {
  capture: <CapturePreview />,
  search: <SearchPreview />,
  views: <ViewsPreview />,
  share: <SharePreview />,
  polish: <ExportPreview />,
};

interface BentoCardProps {
  name: string;
  className: string;
  background: ReactNode;
  Icon: React.ComponentType<{ className?: string }>;
  description: string;
  href: string;
  cta: string;
  id?: string;
  index?: number;
}

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  id = "",
  index = 0,
}: BentoCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px",
      },
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const preview = id ? featurePreviews[id] : null;
  const delay = index * 100;

  return (
    <div
      ref={cardRef}
      key={name}
      data-visible={isVisible}
      className={cn(
        "bento-card group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-3xl",
        "border border-border/60 bg-surface/70",
        "hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5",
        className,
      )}
      style={{ "--card-delay": `${delay}ms` } as React.CSSProperties}
    >
      <div className="absolute inset-0">{background}</div>

      {/* Gradient overlay on hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/0 via-accent/0 to-accent/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="pointer-events-none relative z-10 flex flex-col gap-2 p-6 transition-colors duration-300">
        <div className="flex items-start justify-between">
          <Icon className="bento-icon h-10 w-10 text-ink transition-colors duration-300 group-hover:text-accent" />

          {/* Feature preview - appears on hover */}
          {preview && (
            <div className="feature-preview pointer-events-auto opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              {preview}
            </div>
          )}
        </div>

        <h3 className="text-xl font-semibold text-ink transition-colors duration-300 group-hover:text-ink">
          {name}
        </h3>

        {/* Description with expand animation */}
        <div className="bento-description overflow-hidden">
          <p className="max-w-lg text-sm text-ink-muted leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {/* CTA Button */}
      <div className="pointer-events-none absolute bottom-0 z-10 flex w-full flex-row items-center p-4 opacity-0 transition-all duration-300 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0">
        <Button.AsChild
          variant="ghost"
          size="sm"
          className="pointer-events-auto group/btn"
        >
          <a href={href} className="flex items-center gap-1">
            {cta}
            <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
          </a>
        </Button.AsChild>
      </div>

      {/* Hover glow effect */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl border-2 border-transparent transition-all duration-300 group-hover:border-accent/20 group-hover:shadow-[inset_0_0_30px_rgba(var(--accent),0.05)]" />
    </div>
  );
};

export { BentoCard, BentoGrid };
export type { BentoCardProps };
