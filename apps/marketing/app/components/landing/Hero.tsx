"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  useReducedMotion,
} from "motion/react";
import { RootNodes } from "./RootNodes";
import { RootTraces } from "./RootTraces";

type NetworkInfo = {
  saveData?: boolean;
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  downlink?: number; // Mbps
  rtt?: number; // ms
};

// Decide whether to load the scroll-driven hero video. Skip on Save-Data,
// 2G/3G effective types, or any 4G that's slower than ~2 Mbps downlink
// (DevTools "Slow 4G" reports effectiveType=4g but downlink≈0.4 Mbps —
// without the downlink check we'd ship 10MB to a 50 KB/s pipe and
// produce a cascade of canceled range requests as scroll seeks thrash
// the buffer).
function shouldServeHeavyHero(): boolean {
  if (typeof navigator === "undefined") return true;
  const conn = (navigator as Navigator & { connection?: NetworkInfo })
    .connection;
  if (!conn) return true; // Safari/Firefox: opt in by default
  if (conn.saveData) return false;
  const t = conn.effectiveType;
  if (t === "slow-2g" || t === "2g" || t === "3g") return false;
  if (
    typeof conn.downlink === "number" &&
    conn.downlink > 0 &&
    conn.downlink < 2
  ) {
    return false;
  }
  if (typeof conn.rtt === "number" && conn.rtt > 600) return false;
  return true;
}

const ACTS = [
  {
    eyebrow: "01 — A SEED",
    title: "Every browser session\nstarts from one root.",
    body: "You open a tab. One thought. One question. The path ahead is unwritten.",
    range: [0.0, 0.16],
  },
  {
    eyebrow: "02 — A FOREST",
    title: "But the web is\na thousand forks.",
    body: "Tabs split. You backtrack. You revisit. By page seven, the trail is gone.",
    range: [0.18, 0.35],
  },
  {
    eyebrow: "03 — THE ROOTS",
    title: "Trail watches\nthe roots grow.",
    body: "A Chrome extension that turns your browsing into a living tree — every click, every detour, every fork preserved.",
    range: [0.38, 0.58],
  },
  {
    eyebrow: "04 — THE MAP",
    title: "See where\nyou've been.",
    body: "Pages become nodes. Navigation becomes branches. Your research finally has a shape.",
    range: [0.62, 0.8],
  },
  {
    eyebrow: "05 — THE TREE",
    title: "Pick up\nany thread.",
    body: "Jump back to where the idea forked. Pin the pages that mattered. Never lose a path again.",
    range: [0.84, 1.0],
  },
] as const;

const SCROLL_LENGTH_VH = 3;

function actInput(
  range: readonly [number, number],
): [number, number, number, number] {
  const [s, e] = range;
  const fade = 0.04;
  return [s - fade, s, e, e + fade];
}
const ACT_OPACITY: [number, number, number, number] = [0, 1, 1, 0];
const ACT_Y: [number, number, number, number] = [16, 0, 0, 16];

export function LandingHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTextRef = useRef<HTMLSpanElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef(0);
  const lastSeekTargetRef = useRef(-1);
  const reduce = useReducedMotion();
  // null = undecided (SSR), false = static poster only, true = full video
  const [enableVideo, setEnableVideo] = useState<boolean | null>(null);
  // Object URL of the fully-buffered MP4. The video element only gets a
  // src once this is set, which means scrubbing only ever reads from
  // memory — no Range: requests, no cancel cascade.
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  // Scroll progress, 0..1 across the *pinned* portion only.
  // Section is 300vh tall with a 100vh sticky child, so pin runs from
  // `sectionTop` to `sectionTop + 200vh`. Mapping progress to the pinned
  // window (not the full section) keeps every act on-screen while the
  // sticky is anchored, and matches the magnet math `50 + center * 200`.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Pre-build per-act opacity/y transforms — Motion drives DOM directly.
  const a0o = useTransform(
    scrollYProgress,
    actInput(ACTS[0].range),
    ACT_OPACITY,
  );
  const a1o = useTransform(
    scrollYProgress,
    actInput(ACTS[1].range),
    ACT_OPACITY,
  );
  const a2o = useTransform(
    scrollYProgress,
    actInput(ACTS[2].range),
    ACT_OPACITY,
  );
  const a3o = useTransform(
    scrollYProgress,
    actInput(ACTS[3].range),
    ACT_OPACITY,
  );
  const a4o = useTransform(
    scrollYProgress,
    actInput(ACTS[4].range),
    ACT_OPACITY,
  );
  const a0y = useTransform(scrollYProgress, actInput(ACTS[0].range), ACT_Y);
  const a1y = useTransform(scrollYProgress, actInput(ACTS[1].range), ACT_Y);
  const a2y = useTransform(scrollYProgress, actInput(ACTS[2].range), ACT_Y);
  const a3y = useTransform(scrollYProgress, actInput(ACTS[3].range), ACT_Y);
  const a4y = useTransform(scrollYProgress, actInput(ACTS[4].range), ACT_Y);
  const acts = [
    { o: a0o, y: a0y },
    { o: a1o, y: a1y },
    { o: a2o, y: a2y },
    { o: a3o, y: a3y },
    { o: a4o, y: a4y },
  ];

  // Decide whether to load the heavy hero video. Runs once after mount
  // so SSR stays neutral; the poster image is the visual fallback while
  // we wait for the IntersectionObserver to fire.
  useEffect(() => {
    if (reduce) {
      setEnableVideo(false);
      return;
    }
    if (!shouldServeHeavyHero()) {
      setEnableVideo(false);
      return;
    }
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setEnableVideo(true);
      return;
    }
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
  }, [reduce]);

  // Fetch the whole file as a single linear stream, then hand it to the
  // <video> as a blob: URL. This sidesteps the HTML5 video element's
  // default Range-request strategy: every scroll-driven currentTime
  // change would otherwise open a new partial-content GET and cancel
  // the in-flight one, which on slow networks shows up as a cascade of
  // canceled hero.mp4 requests and the file never actually finishes.
  // With a blob: URL there is no network during scrubbing — seeks read
  // from memory.
  useEffect(() => {
    if (!enableVideo) return;
    const ac = new AbortController();
    let objectUrl: string | null = null;
    fetch("/landing/hero.mp4", { signal: ac.signal, cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`hero.mp4 ${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setVideoSrc(objectUrl);
      })
      .catch(() => {
        /* aborted on unmount, or offline — poster stays */
      });
    return () => {
      ac.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enableVideo]);

  // Cache duration once metadata for the in-memory blob is parsed.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoSrc) return;
    const onMeta = () => {
      durationRef.current = v.duration || 0;
    };
    if (v.readyState >= 1) onMeta();
    else v.addEventListener("loadedmetadata", onMeta, { once: true });
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [videoSrc]);

  // Imperative DOM updates per scroll tick — no React re-renders.
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    // 1) Drive the video.
    const v = videoRef.current;
    const dur = durationRef.current;
    if (v && dur && !reduce) {
      const target = Math.min(p * dur, dur - 0.05);
      // Skip if the seek delta is below one frame (~33ms at 30fps).
      if (Math.abs(target - lastSeekTargetRef.current) > 1 / 30) {
        lastSeekTargetRef.current = target;
        // fastSeek where supported (Safari) avoids decode-from-keyframe stalls.
        if (
          typeof (v as HTMLVideoElement & { fastSeek?: (t: number) => void })
            .fastSeek === "function"
        ) {
          (v as HTMLVideoElement & { fastSeek: (t: number) => void }).fastSeek(
            target,
          );
        } else {
          v.currentTime = target;
        }
      }
    }

    // 2) Update progress text directly (no re-render).
    if (progressTextRef.current) {
      progressTextRef.current.textContent =
        String(Math.round(p * 100)).padStart(2, "0") + " / 100";
    }

    // 3) Update scroll cue opacity directly.
    if (cueRef.current) {
      cueRef.current.style.opacity = p < 0.04 ? "1" : "0";
    }
  });

  return (
    <section
      ref={sectionRef}
      className="relative w-full"
      style={{
        height: `${SCROLL_LENGTH_VH * 100}vh`,
      }}
      aria-label="Trail introduction"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-[var(--landing-bg)]">
        {/* Always-rendered poster — covers the slow-network fallback path
            and shows immediately while the video (if any) is fetched. */}
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
        {enableVideo && videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              filter: "saturate(1.05) contrast(1.02)",
              transform: "translateZ(0)",
            }}
          />
        ) : null}

        {/* Vignette */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 55%, transparent 40%, rgba(10,9,8,0.55) 100%)",
          }}
        />

        {/* SVG root traces — visible whenever the video isn't (slow
            connection, reduced motion, or while it's still loading).
            Provides scroll-driven motion that matches the hero metaphor
            without any extra network. */}
        {!videoSrc ? <RootTraces progress={scrollYProgress} /> : null}

        {/* Root-tip nodes — receives a quantized motion value */}
        <RootNodes progress={scrollYProgress} />

        {/* Left text rail with five overlapping acts */}
        <div className="pointer-events-none absolute inset-0 flex items-center px-6 sm:px-10 md:px-16 lg:px-24">
          <div className="relative w-full max-w-[560px] sm:w-[min(560px,50vw)] min-h-[280px]">
            {ACTS.map((a, i) => (
              <motion.div
                key={i}
                className="absolute inset-0 pointer-events-none"
                style={{
                  opacity: acts[i].o,
                  y: acts[i].y,
                }}
              >
                <div
                  className="font-mono uppercase mb-[18px]"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    color: "var(--landing-ember)",
                  }}
                >
                  {a.eyebrow}
                </div>
                <h2
                  className="font-serif text-[var(--landing-ink)]"
                  style={{
                    fontSize: "clamp(36px, 5.2vw, 68px)",
                    fontWeight: 400,
                    lineHeight: 1.02,
                    letterSpacing: "-0.025em",
                    whiteSpace: "pre-line",
                    marginBottom: 24,
                    textWrap: "balance" as React.CSSProperties["textWrap"],
                  }}
                >
                  {a.title}
                </h2>
                <p
                  className="text-[16px] leading-[1.55] font-normal"
                  style={{
                    color: "rgba(246,239,225,0.78)",
                    maxWidth: 460,
                  }}
                >
                  {a.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom progress + scroll cue */}
        <div
          className="pointer-events-none absolute bottom-9 left-6 right-6 sm:left-10 sm:right-10 md:left-16 md:right-16 lg:left-24 lg:right-24 flex items-center justify-between font-mono uppercase"
          style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "rgba(246,239,225,0.42)",
          }}
        >
          <div className="flex items-center gap-3.5">
            <span className="block h-px w-7 bg-[rgba(246,239,225,0.4)]" />
            <span ref={progressTextRef}>00 / 100</span>
          </div>
          <div
            ref={cueRef}
            className="flex items-center gap-2.5"
            style={{ transition: "opacity 300ms ease", opacity: 1 }}
            aria-hidden="true"
          >
            <span>Scroll</span>
            <span className="inline-block h-5 w-px bg-[rgba(246,239,225,0.4)] [animation:scrollCue_1.6s_ease-in-out_infinite]" />
          </div>
        </div>

        <style jsx>{`
          @keyframes scrollCue {
            0%,
            100% {
              transform: translateY(-4px);
              opacity: 0.4;
            }
            50% {
              transform: translateY(4px);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
