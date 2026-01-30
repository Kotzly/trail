"use client";

import * as React from "react";

const VIDEO_SELECTOR = "video[data-play-on-view]";
const VIDEO_THRESHOLD = 0.35;
const VIDEO_ROOT_MARGIN = "0px 0px -10% 0px";

export function VideoObserver() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const videos = Array.from(
      document.querySelectorAll<HTMLVideoElement>(VIDEO_SELECTOR)
    );

    if (videos.length === 0) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      videos.forEach((video) => {
        if (!video.paused) video.pause();
      });
      return;
    }

    const safePlay = (video: HTMLVideoElement) => {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            safePlay(target);
            return;
          }
          if (!target.paused) target.pause();
        });
      },
      { threshold: VIDEO_THRESHOLD, rootMargin: VIDEO_ROOT_MARGIN }
    );

    videos.forEach((video) => observer.observe(video));

    return () => observer.disconnect();
  }, []);

  return null;
}
