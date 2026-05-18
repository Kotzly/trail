"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

// Static hero used on:
//   - mobile / touchscreen devices (cinematic scroll-scrub is unusable
//     on real iPhones — touch scroll thread, video decoder, and Safari's
//     seek pipeline all disagree on the frame budget)
//   - reduced-motion users on any device
//   - SSR / before-mount (prevents hydration mismatch and layout jump)
//
// One screen tall, poster + headline + CTA. On mobile (and only on
// mobile — reduced-motion users skip it entirely), a small hero-mobile.mp4
// plays through *once* on its own timeline and holds on the last frame.
// No looping (would feel restless), no scroll coupling (would lag).

function userOptedOutOfVideo(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return true;
    }
  }
  if (typeof navigator === "undefined") return false;
  const conn = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (conn?.saveData) return true;
  if (conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g") {
    return true;
  }
  return false;
}

export function LandingHeroStatic() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const t = useTranslations("landing");
  const tStatic = useTranslations("landing.static");
  // null = SSR / undecided, false = poster only (opt-out), true = mount video.
  const [enableVideo, setEnableVideo] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    if (userOptedOutOfVideo()) return false;
    if (typeof IntersectionObserver === "undefined") return true;
    return null;
  });

  // Defer the video fetch until the section is approaching the viewport.
  // On mobile the user lands at scroll=0, so this fires immediately —
  // mostly a guard for any future deep-link scenarios.
  useEffect(() => {
    if (enableVideo !== null) return;
    const section = sectionRef.current;
    if (!section) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setEnableVideo(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(section);
    return () => io.disconnect();
  }, [enableVideo]);

  // iOS Safari sometimes ignores the autoplay attribute on a freshly
  // attached <video>; the autoplay heuristic loses to the metadata
  // parse. Calling play() explicitly after `loadeddata` recovers.
  // A rejection (hard autoplay denial) is harmless — poster stays.
  useEffect(() => {
    if (!enableVideo) return;
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => {
      const promise = v.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(() => {});
      }
    };
    if (v.readyState >= 2) tryPlay();
    else v.addEventListener("loadeddata", tryPlay, { once: true });
    return () => v.removeEventListener("loadeddata", tryPlay);
  }, [enableVideo]);

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden bg-[var(--landing-bg)]"
      aria-label={t("heroAriaLabel")}
      style={{
        minHeight: "100svh",
        // svh > vh on iOS Safari — accounts for the dynamic URL bar so
        // the CTA never sits below the chrome.
      }}
    >
      <picture>
        <source srcSet="/landing/hero-poster.webp" type="image/webp" />
        <img
          src="/landing/hero-poster.jpg"
          alt=""
          aria-hidden="true"
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            filter: "saturate(1.05) contrast(1.02)",
            transform: "translateZ(0)",
          }}
        />
      </picture>
      {enableVideo ? (
        <video
          ref={videoRef}
          src="/landing/hero-mobile.mp4"
          poster="/landing/hero-poster.jpg"
          muted
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover hero-fade-in"
          style={{
            filter: "saturate(1.05) contrast(1.02)",
            transform: "translateZ(0)",
          }}
        />
      ) : null}

      {/* Vignette + bottom fade for legibility. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, transparent 35%, rgba(10,9,8,0.55) 100%), linear-gradient(180deg, rgba(10,9,8,0.15) 0%, rgba(10,9,8,0.6) 65%, rgba(10,9,8,0.92) 100%)",
        }}
      />

      <div className="relative z-[5] flex min-h-[100svh] flex-col justify-end px-6 pb-16 pt-28 sm:px-10 sm:pb-20 sm:pt-32">
        <div className="mx-auto w-full max-w-[640px]">
          {/* Eyebrow + title mirror cinematic act 01 verbatim so the
              SSR→cinematic swap (on desktop, after mount) is content-stable. */}
          <div
            className="font-mono uppercase mb-[18px]"
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              color: "var(--landing-ember)",
            }}
          >
            {tStatic("eyebrow")}
          </div>
          <h2
            className="font-serif text-[var(--landing-ink)]"
            style={{
              fontSize: "clamp(40px, 9vw, 64px)",
              fontWeight: 400,
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
              marginBottom: 22,
              whiteSpace: "pre-line",
              textWrap: "balance" as React.CSSProperties["textWrap"],
            }}
          >
            {tStatic("title")}
          </h2>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.55,
              color: "rgba(246,239,225,0.78)",
              maxWidth: 460,
              marginBottom: 32,
            }}
          >
            {tStatic("body")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--landing-ink)] px-5 py-3 text-[14px] font-semibold text-[#0a0908] shadow-[0_0_0_1px_rgba(246,239,225,0.1)] transition-transform duration-200 ease-out hover:-translate-y-px active:scale-[0.97]"
            >
              {tStatic("addToChrome")}
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--landing-line-strong)] px-5 py-3 text-[13px] font-medium text-[var(--landing-ink-2)] transition-colors duration-200 hover:text-[var(--landing-ink)] hover:border-[var(--landing-ember)]"
            >
              {tStatic("seeHowItWorks")}
              <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
