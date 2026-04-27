"use client";

import { useState } from "react";
import { motion, type MotionValue, useTransform } from "motion/react";

type Direction = "left" | "right" | "down";

type RootNode = {
  x: number;
  y: number;
  dir: Direction;
  delay: number;
  favicon: FaviconKind;
  title: string;
  domain: string;
  preview: string;
};

type FaviconKind = "wiki" | "arxiv" | "gh" | "so" | "hn" | "figma" | "yt";

const NODES: RootNode[] = [
  {
    x: 50,
    y: 22,
    dir: "down",
    delay: 0.0,
    favicon: "wiki",
    title: "History of typography",
    domain: "wikipedia.org",
    preview:
      "From Gutenberg's movable type to Helvetica — the evolution of letterforms.",
  },
  {
    x: 30,
    y: 28,
    dir: "left",
    delay: 0.02,
    favicon: "arxiv",
    title: "Attention is all you need",
    domain: "arxiv.org",
    preview:
      "Vaswani et al., 2017 — the paper that introduced the Transformer architecture.",
  },
  {
    x: 70,
    y: 26,
    dir: "right",
    delay: 0.03,
    favicon: "figma",
    title: "Trail · Mood board",
    domain: "figma.com",
    preview: "14 frames · Last edited 2 hours ago by you.",
  },
  {
    x: 18,
    y: 42,
    dir: "left",
    delay: 0.06,
    favicon: "so",
    title: "How does sticky work?",
    domain: "stackoverflow.com",
    preview:
      "4.2k upvotes · position: sticky needs a scrollable ancestor without overflow.",
  },
  {
    x: 40,
    y: 48,
    dir: "left",
    delay: 0.07,
    favicon: "gh",
    title: "facebook / react",
    domain: "github.com",
    preview: "236k stars · A JavaScript library for building user interfaces.",
  },
  {
    x: 60,
    y: 46,
    dir: "right",
    delay: 0.08,
    favicon: "hn",
    title: "Show HN: a tree for tabs",
    domain: "news.ycombinator.com",
    preview:
      "312 points · 84 comments · A new way to think about browser history.",
  },
  {
    x: 82,
    y: 44,
    dir: "right",
    delay: 0.06,
    favicon: "yt",
    title: "On craft (talk)",
    domain: "youtube.com",
    preview: "42 min · Anthony Bourdain on doing the work, every day.",
  },
  {
    x: 10,
    y: 58,
    dir: "left",
    delay: 0.11,
    favicon: "arxiv",
    title: "Self-attention, revisited",
    domain: "arxiv.org",
    preview:
      "A 2024 survey of efficient attention variants — sparse, linear, recurrent.",
  },
  {
    x: 26,
    y: 62,
    dir: "left",
    delay: 0.13,
    favicon: "gh",
    title: "tannerlinsley / react-query",
    domain: "github.com",
    preview: "40k stars · Hooks for fetching, caching and updating async data.",
  },
  {
    x: 44,
    y: 64,
    dir: "left",
    delay: 0.15,
    favicon: "so",
    title: "When to use useMemo",
    domain: "stackoverflow.com",
    preview:
      "“Don't reach for it until you've measured.” — Dan Abramov, in the comments.",
  },
  {
    x: 56,
    y: 64,
    dir: "right",
    delay: 0.15,
    favicon: "figma",
    title: "Components / Buttons v3",
    domain: "figma.com",
    preview: "12 variants · 6 collaborators · Used in 41 files.",
  },
  {
    x: 74,
    y: 62,
    dir: "right",
    delay: 0.13,
    favicon: "hn",
    title: "Ask HN: how do you read papers?",
    domain: "news.ycombinator.com",
    preview:
      "186 comments · Skim → highlight → re-read → write notes in your own words.",
  },
  {
    x: 90,
    y: 58,
    dir: "right",
    delay: 0.11,
    favicon: "wiki",
    title: "Forest ecology",
    domain: "wikipedia.org",
    preview: "Mycorrhizal networks — how trees share nutrients underground.",
  },
  {
    x: 6,
    y: 76,
    dir: "left",
    delay: 0.18,
    favicon: "yt",
    title: "Suzanne Simard · Mother trees",
    domain: "youtube.com",
    preview:
      "TED · 18 min · Forests are wired for cooperation, not just competition.",
  },
  {
    x: 20,
    y: 84,
    dir: "left",
    delay: 0.2,
    favicon: "gh",
    title: "pmndrs / zustand",
    domain: "github.com",
    preview:
      "47k stars · A small, fast and scalable state-management solution.",
  },
  {
    x: 36,
    y: 88,
    dir: "left",
    delay: 0.22,
    favicon: "wiki",
    title: "Slime mould networks",
    domain: "wikipedia.org",
    preview:
      "“Physarum polycephalum” solves shortest-path problems without a brain.",
  },
  {
    x: 50,
    y: 92,
    dir: "down",
    delay: 0.24,
    favicon: "arxiv",
    title: "Emergent abilities of LLMs",
    domain: "arxiv.org",
    preview:
      "“Capabilities not present in smaller models appear at scale.” — Wei et al., 2022.",
  },
  {
    x: 64,
    y: 88,
    dir: "right",
    delay: 0.22,
    favicon: "figma",
    title: "Hero · Animation refs",
    domain: "figma.com",
    preview: "Scroll-driven sequences from Apple, Stripe, Linear — annotated.",
  },
  {
    x: 80,
    y: 84,
    dir: "right",
    delay: 0.2,
    favicon: "so",
    title: "Smooth canvas resize",
    domain: "stackoverflow.com",
    preview:
      "“Use ResizeObserver, not the window resize event.” — top answer, 1.1k upvotes.",
  },
  {
    x: 94,
    y: 76,
    dir: "right",
    delay: 0.18,
    favicon: "hn",
    title: "The garden, not the stream",
    domain: "news.ycombinator.com",
    preview: "Mike Caulfield · An essay on how we should be building the web.",
  },
];

const FAVICON_STYLE: Record<
  FaviconKind,
  { bg: string; fg: string; label: string; serif?: boolean }
> = {
  wiki: { bg: "#fff", fg: "#000", label: "W", serif: true },
  arxiv: { bg: "#b31b1b", fg: "#fff", label: "χ" },
  gh: { bg: "#24292f", fg: "#fff", label: "●" },
  so: { bg: "#f48024", fg: "#fff", label: "S" },
  hn: { bg: "#ff6600", fg: "#fff", label: "Y" },
  figma: { bg: "#0acf83", fg: "#fff", label: "F" },
  yt: { bg: "#ff0033", fg: "#fff", label: "▶" },
};

function Favicon({ kind }: { kind: FaviconKind }) {
  const s = FAVICON_STYLE[kind];
  return (
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        fontWeight: 700,
        fontSize: 10,
        background: s.bg,
        color: s.fg,
        fontFamily: s.serif ? "Georgia, serif" : "var(--font-sans)",
      }}
    >
      {s.label}
    </div>
  );
}

const WIN_START = 0.55;
// Each node fades in over a slightly longer window than the old 0.05
// step so the curve reads as smooth rather than popping.
const FADE_LEN = 0.09;

function NodeWaypoint({
  node,
  index,
  progress,
  hovered,
  pinned,
  setHovered,
  setPinned,
}: {
  node: RootNode;
  index: number;
  progress: MotionValue<number>;
  hovered: number | null;
  pinned: number | null;
  setHovered: (i: number | null) => void;
  setPinned: (i: number | null) => void;
}) {
  const localStart = WIN_START + node.delay;
  const localEnd = localStart + FADE_LEN;

  // Continuous opacity curve: 0 before localStart, 1 after localEnd.
  const opacity = useTransform(progress, [localStart, localEnd], [0, 1], {
    clamp: true,
  });
  // Subtle slide-in matching the act-text idiom (translate from 12px → 0).
  const translateY = useTransform(progress, [localStart, localEnd], [12, 0], {
    clamp: true,
  });
  const translateX = useTransform(
    progress,
    [localStart, localEnd],
    [node.dir === "left" ? -8 : node.dir === "right" ? 8 : 0, 0],
    { clamp: true },
  );
  // Slight scale-up so it feels like the card is being placed, not popping in.
  const scale = useTransform(progress, [localStart, localEnd], [0.94, 1], {
    clamp: true,
  });
  // The card becomes interactive (pointer-events) only after it's
  // mostly visible; "pointerEvents" can be a MotionValue<string>.
  const pointerEvents = useTransform(progress, (p) =>
    p > localStart + FADE_LEN * 0.6 ? "auto" : "none",
  );
  // CSS visibility — keeps fully-faded cards out of the hit-testing
  // tree and the compositor's painting cycle. Switches once near zero.
  const visibility = useTransform(progress, (p) =>
    p > localStart - 0.02 ? "visible" : "hidden",
  );
  // Dim the card when another is active.
  const isActive = hovered === index || pinned === index;
  const dimmed = (hovered !== null || pinned !== null) && !isActive;
  const dimMul = dimmed ? 0.35 : 1;
  const finalOpacity = useTransform(opacity, (v) => v * dimMul);

  const cardTransform =
    node.dir === "left"
      ? "translateX(calc(-100% - 36px))"
      : node.dir === "right"
        ? "translateX(36px)"
        : "translate(-50%, 30px)";
  const hoverScale = isActive ? 1.06 : 1;

  return (
    <motion.div
      onMouseEnter={() => setHovered(index)}
      onMouseLeave={() => setHovered(null)}
      onClick={() => setPinned(pinned === index ? null : index)}
      style={{
        position: "absolute",
        left: `${node.x}%`,
        top: `${node.y}%`,
        x: translateX,
        y: translateY,
        scale,
        opacity: finalOpacity,
        visibility,
        pointerEvents,
        translateX: "-50%",
        translateY: "-50%",
        display: "flex",
        alignItems: "center",
        cursor: "pointer",
        padding: 18,
        margin: -18,
        willChange: "transform, opacity",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: isActive ? 12 : 8,
          height: isActive ? 12 : 8,
          borderRadius: 999,
          background:
            "radial-gradient(circle, #fff5d6 0%, var(--landing-ember) 50%, transparent 75%)",
          transform: "translate(-50%, -50%)",
          filter: `drop-shadow(0 0 ${isActive ? 14 : 6}px rgba(248,211,100,${isActive ? 1 : 0.8}))`,
          transition: "all .2s ease",
          animation: isActive
            ? "rootNodePulse 1.4s ease-in-out infinite"
            : "none",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 28,
          height: 1,
          background: isActive
            ? "linear-gradient(90deg, rgba(248,211,100,1), rgba(248,211,100,0.4))"
            : "linear-gradient(90deg, rgba(248,211,100,0.7), rgba(246,239,225,0.18))",
          transformOrigin: "0 50%",
          transform:
            node.dir === "left"
              ? "translate(-100%, -50%) scaleX(1) rotate(180deg)"
              : node.dir === "down"
                ? "translate(-50%, 0) rotate(90deg)"
                : "translate(0, -50%)",
          transition: "background .2s ease",
        }}
      />
      <div
        style={{
          position: "relative",
          transform: `${cardTransform} scale(${hoverScale})`,
          transformOrigin:
            node.dir === "left"
              ? "right center"
              : node.dir === "right"
                ? "left center"
                : "center top",
          padding: "8px 12px",
          minWidth: 180,
          maxWidth: 260,
          background: isActive
            ? "rgba(28, 22, 14, 0.96)"
            : "rgba(20, 17, 12, 0.92)",
          border: isActive
            ? "0.5px solid rgba(248, 211, 100, 0.85)"
            : "0.5px solid rgba(248, 211, 100, 0.35)",
          borderRadius: 9,
          boxShadow: isActive
            ? "0 8px 24px rgba(0,0,0,0.6), 0 0 24px rgba(248,211,100,0.3)"
            : "0 6px 16px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          gap: 9,
          transition:
            "background .15s, border-color .15s, box-shadow .15s, transform .15s",
        }}
      >
        <Favicon kind={node.favicon} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--landing-ink)",
              lineHeight: 1.2,
              letterSpacing: "-0.005em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {node.title}
          </div>
          <div
            style={{
              fontSize: 9.5,
              color: "rgba(246,239,225,0.5)",
              fontFamily: "var(--font-mono)",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {node.domain}
          </div>
          <div
            style={{
              maxHeight: isActive ? 80 : 0,
              opacity: isActive ? 1 : 0,
              overflow: "hidden",
              transition:
                "max-height .3s ease, opacity .2s ease, margin-top .3s ease",
              marginTop: isActive ? 8 : 0,
              borderTop: isActive
                ? "0.5px solid rgba(248,211,100,0.2)"
                : "none",
              paddingTop: isActive ? 6 : 0,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "rgba(246,239,225,0.75)",
                lineHeight: 1.45,
              }}
            >
              {node.preview}
            </div>
            <div
              style={{
                fontSize: 9,
                color: "var(--landing-ember)",
                fontFamily: "var(--font-mono)",
                marginTop: 4,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Open ↗
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function RootNodes({ progress }: { progress: MotionValue<number> }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);

  return (
    <div className="absolute inset-0 z-[3] pointer-events-none">
      {NODES.map((n, i) => (
        <NodeWaypoint
          key={i}
          node={n}
          index={i}
          progress={progress}
          hovered={hovered}
          pinned={pinned}
          setHovered={setHovered}
          setPinned={setPinned}
        />
      ))}
      <style>{`
        @keyframes rootNodePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(248,211,100,0.5); }
          50% { box-shadow: 0 0 0 8px rgba(248,211,100,0); }
        }
      `}</style>
    </div>
  );
}
