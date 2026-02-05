"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { marketingCopy } from "@trail/content";
import { motion } from "motion/react";
import { ThemeToggle } from "../../components/ThemeToggle";
import { TrailLogo } from "../../components/TrailLogo";

interface MarketingNavProps {
  appBaseUrl: string;
}

export function MarketingNav({ appBaseUrl }: MarketingNavProps) {
  const { nav } = marketingCopy;
  const [isOpen, setIsOpen] = React.useState(false);
  const linkTabIndex = isOpen ? 0 : -1;

  const closeMenu = () => setIsOpen(false);

  const navItems = [
    {
      href: "/features",
      label: nav.features,
    },
    {
      href: "/pricing",
      label: nav.pricing,
    },
    {
      href: "/faq",
      label: nav.faq,
    },
    {
      href: "/support",
      label: nav.support,
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-stroke/40 bg-base/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <motion.a
          href="/"
          className="flex items-center gap-3 rounded-full text-lg font-display font-semibold tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          onClick={closeMenu}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <span className="trail-card-compact flex items-center justify-center bg-transparent border-transparent">
            <TrailLogo className="trail-logo--md" />
          </span>
          trail
        </motion.a>
        <nav className="hidden items-center gap-5 text-sm font-medium text-ink-subtle md:flex">
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
        <div className="flex items-center gap-3">
          <ThemeToggle className="border-stroke/50 bg-surface/70 text-ink hover:bg-surface-strong" />
          <a
            href={appBaseUrl}
            className="hidden rounded-full border border-stroke/60 px-4 py-2 text-sm font-medium text-ink transition hover:border-stroke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base md:inline-flex"
          >
            {nav.signIn}
          </a>
          <Link
            href="/downloads"
            className="cta-primary hidden rounded-full bg-cta px-4 py-2 text-sm font-medium text-cta-fg transition hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base md:inline-flex"
          >
            {nav.getStarted}
          </Link>
          <button
            type="button"
            aria-controls="marketing-mobile-menu"
            aria-expanded={isOpen}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke/50 bg-surface/70 text-ink transition hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base md:hidden"
          >
            <span className="sr-only">Toggle menu</span>
            {isOpen ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </div>
      <motion.div
        id="marketing-mobile-menu"
        aria-hidden={!isOpen}
        initial={false}
        animate={isOpen ? "open" : "closed"}
        variants={{
          open: {
            opacity: 1,
            y: 0,
            height: "auto",
            transition: {
              duration: 0.22,
              ease: "easeInOut",
              when: "beforeChildren",
              staggerChildren: 0.04,
            },
          },
          closed: {
            opacity: 0,
            y: -8,
            height: 0,
            transition: {
              duration: 0.18,
              ease: "easeInOut",
              when: "afterChildren",
              staggerChildren: 0.02,
              staggerDirection: -1,
            },
          },
        }}
        className="relative overflow-hidden border-t border-stroke/40 px-6 md:hidden"
      >
        <motion.nav
          className="pt-4 flex flex-col items-center justify-center gap-4 text-sm font-medium text-ink"
          variants={{
            open: { transition: { staggerChildren: 0.04 } },
            closed: {
              transition: { staggerChildren: 0.02, staggerDirection: -1 },
            },
          }}
        >
          {navItems.map((item) => (
            <motion.a
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              tabIndex={linkTabIndex}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
              variants={{
                open: { opacity: 1, y: 0 },
                closed: { opacity: 0, y: -6 },
              }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              {item.label}
            </motion.a>
          ))}
        </motion.nav>

        <motion.div
          className="mt-6 pb-6 flex flex-col gap-3"
          variants={{
            open: { opacity: 1, y: 0 },
            closed: { opacity: 0, y: -6 },
          }}
          transition={{ duration: 0.18, ease: "easeInOut" }}
        >
          <a
            href={appBaseUrl}
            className="inline-flex items-center justify-center rounded-full bg-base border border-stroke/60 px-4 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            tabIndex={linkTabIndex}
          >
            {nav.signIn}
          </a>

          <Link
            href="/downloads"
            className="cta-primary inline-flex items-center justify-center rounded-full bg-cta px-4 py-2 text-sm font-medium text-cta-fg transition hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            onClick={closeMenu}
            tabIndex={linkTabIndex}
          >
            {nav.getStarted}
          </Link>
        </motion.div>
      </motion.div>
    </header>
  );
}
