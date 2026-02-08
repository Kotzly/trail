"use client";

import * as React from "react";
import { motion } from "motion/react";
import { marketingCopy } from "@trail/content";
import { TrailLogo } from "../../components/TrailLogo";
import { GetTrailButton } from "./GetTrailButton";

const navItems = [
  {
    href: "/#features",
    label: marketingCopy.nav.features,
  },
  {
    href: "/#faq",
    label: marketingCopy.nav.faq,
  },
];

export function MarketingNav() {
  const [isPastHero, setIsPastHero] = React.useState(false);

  React.useEffect(() => {
    if (
      typeof IntersectionObserver === "undefined" ||
      typeof MutationObserver === "undefined"
    ) {
      return;
    }

    let heroEl: HTMLElement | null = null;
    let heroObserver: IntersectionObserver | null = null;

    const disconnectHeroObserver = () => {
      heroObserver?.disconnect();
      heroObserver = null;
    };

    const observeHero = () => {
      const nextHeroEl = document.querySelector<HTMLElement>("[data-marketing-hero]");
      if (nextHeroEl === heroEl) return;

      disconnectHeroObserver();
      heroEl = nextHeroEl;

      if (!heroEl) {
        setIsPastHero(false);
        return;
      }

      heroObserver = new IntersectionObserver(
        ([entry]) => {
          setIsPastHero(entry.boundingClientRect.bottom <= 0);
        },
        { threshold: 0 },
      );

      heroObserver.observe(heroEl);
    };

    observeHero();

    const domObserver = new MutationObserver(() => {
      observeHero();
    });
    domObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      domObserver.disconnect();
      disconnectHeroObserver();
    };
  }, []);

  return (
    <>
      <header className="relative z-30">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
          <div className="flex items-center gap-6 sm:gap-8">
            <motion.a
              href="/"
              className="flex items-center gap-2.5 rounded-full text-lg font-display font-semibold tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <TrailLogo className="trail-logo--md" />
              Trail
            </motion.a>

            <nav className="flex items-center gap-4 text-sm font-medium text-ink-subtle sm:gap-6">
              {navItems.map((item) => (
                <motion.a
                  key={item.href}
                  href={item.href}
                  className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  {item.label}
                </motion.a>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <motion.div
        aria-hidden={!isPastHero}
        className="fixed right-4 top-4 z-50"
        initial={{ opacity: 0, y: -12 }}
        animate={isPastHero ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        style={{ pointerEvents: isPastHero ? "auto" : "none" }}
      >
        <GetTrailButton
          href="/downloads"
          showIcon={false}
          className="h-10 px-5 shadow-[var(--trail-elev-3)]"
        >
          Get Trail
        </GetTrailButton>
      </motion.div>
    </>
  );
}
