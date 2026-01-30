"use client";

import * as React from "react";

const REVEAL_SELECTOR = ".reveal";
const REVEAL_THRESHOLD = 0.15;
const REVEAL_ROOT_MARGIN = "0px 0px -10% 0px";

export function RevealObserver() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const revealAll = () => {
      document
        .querySelectorAll<HTMLElement>(REVEAL_SELECTOR)
        .forEach((element) => {
          element.dataset.reveal = "true";
        });
    };

    if (prefersReducedMotion) {
      revealAll();
      return;
    }

    const supportsViewTimeline =
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("animation-timeline: view()");

    if (supportsViewTimeline) return;

    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)
    );

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = entry.target as HTMLElement;
          target.dataset.reveal = "true";
          observer.unobserve(target);
        });
      },
      { threshold: REVEAL_THRESHOLD, rootMargin: REVEAL_ROOT_MARGIN }
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  return null;
}
