"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Download,
  FaBrave,
  FaChrome,
  FaEdge,
  FaFirefoxBrowser,
  FaSafari,
} from "@trail/ui/icons";
import { Button } from "@trail/ui";
import { GlowingEffect } from "../ui/glowing-effect";
import {
  HeroBadge,
  HeroSubtitle,
  HeroTitle,
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../../shared/marketing-primitives";

const browserIconMap: Record<
  string,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  chrome: FaChrome,
  brave: FaBrave,
  edge: FaEdge,
  firefox: FaFirefoxBrowser,
  safari: FaSafari,
};

interface BrowserCardsSectionProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  browsers?: {
    id?: string;
    name: string;
    icon?: string;
    status?: string;
    color?: string;
    storeUrl?: string;
  }[];
}

export function BrowserCardsSection({
  eyebrow = "Get Started",
  title = "Install Trail in seconds",
  subtitle = "Available for Chrome, Brave, and Edge. Firefox and Safari support coming soon.",
  browsers = [],
}: BrowserCardsSectionProps) {
  const [detectedBrowser, setDetectedBrowser] = useState("chrome");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("firefox")) setDetectedBrowser("firefox");
    else if (ua.includes("edg/")) setDetectedBrowser("edge");
    else if (ua.includes("chrome")) setDetectedBrowser("chrome");
    else if (ua.includes("safari")) setDetectedBrowser("safari");
  }, []);

  return (
    <PageSection spacing="hero" className="pb-16">
      <SectionContainer size="lg">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <HeroBadge>
            <Download className="h-3.5 w-3.5" />
            {eyebrow}
          </HeroBadge>
          <HeroTitle>{title}</HeroTitle>
          <HeroSubtitle>{subtitle}</HeroSubtitle>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {browsers.map((browser) => {
            const isDetected = detectedBrowser === browser.id;
            const isAvailable = browser.status === "available";
            const Icon = browserIconMap[browser.icon ?? browser.id ?? ""] ?? FaChrome;
            return (
              <motion.div
                key={browser.id ?? browser.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <SurfaceCard
                  className={
                    isDetected
                      ? "group relative p-6 shadow-lg shadow-accent/10"
                      : "group relative p-6"
                  }
                >
                  {isDetected && (
                    <GlowingEffect
                      spread={30}
                      glow
                      disabled={false}
                      proximity={40}
                      inactiveZone={0.01}
                      borderWidth={2}
                    />
                  )}
                  <div className="relative">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: `${browser.color ?? "#4285F4"}15`,
                      }}
                    >
                      <Icon
                        className="h-7 w-7"
                        style={{ color: browser.color ?? "#4285F4" }}
                      />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-ink">
                      {browser.name}
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={
                          isAvailable
                            ? "inline-flex h-2 w-2 rounded-full bg-green-500"
                            : "inline-flex h-2 w-2 rounded-full bg-amber-500"
                        }
                      />
                      <span className="text-xs text-ink-subtle">
                        {isAvailable ? "Available now" : "Coming soon"}
                      </span>
                    </div>
                    {isDetected && (
                      <span className="absolute -right-2 -top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-cta-fg">
                        Detected
                      </span>
                    )}
                    <div className="mt-4">
                      {isAvailable ? (
                        <Button className="w-full">Install Now</Button>
                      ) : (
                        <Button variant="outline" className="w-full" disabled>
                          Coming Soon
                        </Button>
                      )}
                    </div>
                  </div>
                </SurfaceCard>
              </motion.div>
            );
          })}
        </div>
      </SectionContainer>
    </PageSection>
  );
}
