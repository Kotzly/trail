"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

type FeatureKind = "graph" | "panel" | "lock" | "pin" | "forest" | "keys";

const FEATURES: Array<{
  eyebrow: string;
  title: string;
  body: string;
  visual: FeatureKind;
}> = [
  {
    eyebrow: "01",
    title: "A graph, not a list",
    body: "Forks when you open from one tab twice. Merges when you revisit. The shape of your research, preserved.",
    visual: "graph",
  },
  {
    eyebrow: "02",
    title: "Lives in the sidepanel",
    body: "Always next to whatever you are reading. ⌘K to search across every node you have ever visited.",
    visual: "panel",
  },
  {
    eyebrow: "03",
    title: "Local-first",
    body: "Nothing leaves your device by default. Cloud sync is opt-in, end-to-end. Your trail is yours.",
    visual: "lock",
  },
  {
    eyebrow: "04",
    title: "Pin & prune",
    body: "Mark what mattered. Delete dead-ends. Reparent and rearrange — undo with ⌘Z, just like text.",
    visual: "pin",
  },
  {
    eyebrow: "05",
    title: "Many trees",
    body: "One for that side project. One for that thesis. Switch contexts without losing the path.",
    visual: "forest",
  },
  {
    eyebrow: "06",
    title: "Keyboard-native",
    body: "⌘K to search, ⌘Z to undo, ⇧L to cycle layouts, P to pin. Built for hands that never leave the home row.",
    visual: "keys",
  },
];

const stroke = "rgba(248, 211, 100, 0.85)";
const dim = "rgba(246, 239, 225, 0.18)";
const sw = 1.25;

function FeatureVisual({
  kind,
  animate,
}: {
  kind: FeatureKind;
  animate: boolean;
}) {
  if (kind === "graph") {
    return (
      <svg width="100%" height="120" viewBox="0 0 220 120" className="block">
        <g style={{ transition: "opacity .4s" }} opacity={animate ? 1 : 0.85}>
          <line
            x1="110"
            y1="20"
            x2="110"
            y2="56"
            stroke={stroke}
            strokeWidth={sw}
          />
          <line
            x1="110"
            y1="56"
            x2="68"
            y2="78"
            stroke={stroke}
            strokeWidth={sw}
          />
          <line
            x1="110"
            y1="56"
            x2="152"
            y2="78"
            stroke={stroke}
            strokeWidth={sw}
          />
          <line
            x1="68"
            y1="78"
            x2="44"
            y2="100"
            stroke={animate ? stroke : dim}
            strokeWidth={sw}
            style={{ transition: "stroke .5s" }}
          />
          <line
            x1="68"
            y1="78"
            x2="86"
            y2="100"
            stroke={animate ? stroke : dim}
            strokeWidth={sw}
            style={{ transition: "stroke .5s .05s" }}
          />
          <line
            x1="152"
            y1="78"
            x2="134"
            y2="100"
            stroke={animate ? stroke : dim}
            strokeWidth={sw}
            style={{ transition: "stroke .5s .1s" }}
          />
          <line
            x1="152"
            y1="78"
            x2="176"
            y2="100"
            stroke={animate ? stroke : dim}
            strokeWidth={sw}
            style={{ transition: "stroke .5s .15s" }}
          />
          <circle cx="110" cy="20" r="4" fill={stroke} />
          <circle cx="110" cy="56" r="3" fill={stroke} />
          <circle cx="68" cy="78" r="3" fill={stroke} />
          <circle cx="152" cy="78" r="3" fill={stroke} />
          <circle
            cx="44"
            cy="100"
            r="2.5"
            fill={animate ? stroke : dim}
            style={{ transition: "fill .5s" }}
          />
          <circle
            cx="86"
            cy="100"
            r="2.5"
            fill={animate ? stroke : dim}
            style={{ transition: "fill .5s .05s" }}
          />
          <circle
            cx="134"
            cy="100"
            r="2.5"
            fill={animate ? stroke : dim}
            style={{ transition: "fill .5s .1s" }}
          />
          <circle
            cx="176"
            cy="100"
            r="2.5"
            fill={animate ? stroke : dim}
            style={{ transition: "fill .5s .15s" }}
          />
        </g>
      </svg>
    );
  }
  if (kind === "panel") {
    return (
      <svg width="100%" height="120" viewBox="0 0 220 120" className="block">
        <rect
          x="6"
          y="18"
          width="208"
          height="86"
          rx="6"
          stroke={dim}
          strokeWidth={sw}
          fill="none"
        />
        <rect
          x="6"
          y="18"
          width="208"
          height="14"
          rx="6"
          stroke={dim}
          strokeWidth={sw}
          fill="none"
        />
        <circle cx="14" cy="25" r="1.6" fill={dim} />
        <circle cx="20" cy="25" r="1.6" fill={dim} />
        <circle cx="26" cy="25" r="1.6" fill={dim} />
        <line x1="18" y1="46" x2="120" y2="46" stroke={dim} strokeWidth={sw} />
        <line x1="18" y1="56" x2="100" y2="56" stroke={dim} strokeWidth={sw} />
        <line x1="18" y1="66" x2="130" y2="66" stroke={dim} strokeWidth={sw} />
        <line x1="18" y1="80" x2="80" y2="80" stroke={dim} strokeWidth={sw} />
        <line x1="18" y1="90" x2="115" y2="90" stroke={dim} strokeWidth={sw} />
        <g
          style={{
            transform: animate ? "translateX(0)" : "translateX(8px)",
            transition: "transform .4s ease, opacity .4s",
          }}
          opacity={animate ? 1 : 0.7}
        >
          <rect
            x="148"
            y="18"
            width="66"
            height="86"
            rx="6"
            fill="rgba(248,211,100,0.06)"
            stroke={stroke}
            strokeWidth={sw}
          />
          <line
            x1="148"
            y1="32"
            x2="214"
            y2="32"
            stroke={stroke}
            strokeWidth={sw}
            opacity="0.4"
          />
          <circle cx="181" cy="46" r="2.2" fill={stroke} />
          <line
            x1="181"
            y1="46"
            x2="170"
            y2="58"
            stroke={stroke}
            strokeWidth={sw}
          />
          <line
            x1="181"
            y1="46"
            x2="192"
            y2="58"
            stroke={stroke}
            strokeWidth={sw}
          />
          <circle cx="170" cy="58" r="1.8" fill={stroke} />
          <circle cx="192" cy="58" r="1.8" fill={stroke} />
          <line
            x1="170"
            y1="58"
            x2="164"
            y2="72"
            stroke={stroke}
            strokeWidth={sw}
          />
          <line
            x1="192"
            y1="58"
            x2="198"
            y2="72"
            stroke={stroke}
            strokeWidth={sw}
          />
          <circle cx="164" cy="72" r="1.6" fill={stroke} />
          <circle cx="198" cy="72" r="1.6" fill={stroke} />
        </g>
      </svg>
    );
  }
  if (kind === "lock") {
    return (
      <svg width="100%" height="120" viewBox="0 0 220 120" className="block">
        <defs>
          <radialGradient id="lock-glow" cx="50%" cy="55%" r="50%">
            <stop offset="0%" stopColor="rgba(248,211,100,0.6)" />
            <stop offset="100%" stopColor="rgba(248,211,100,0)" />
          </radialGradient>
        </defs>
        <rect
          x="60"
          y="18"
          width="100"
          height="86"
          rx="10"
          stroke={dim}
          strokeWidth={sw}
          fill="none"
        />
        <ellipse
          cx="110"
          cy="64"
          rx={animate ? 38 : 26}
          ry={animate ? 22 : 16}
          fill="url(#lock-glow)"
          style={{ transition: "all .6s ease" }}
        />
        <rect
          x="60"
          y="18"
          width="100"
          height="86"
          rx="10"
          stroke={stroke}
          strokeWidth={sw}
          fill="none"
          strokeDasharray={animate ? "0 0" : "4 6"}
          style={{ transition: "stroke-dasharray .5s" }}
        />
        <g opacity={animate ? 0.55 : 0} style={{ transition: "opacity .4s" }}>
          <path
            d="M 110 30 L 110 22 M 106 26 L 110 22 L 114 26"
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 110 92 L 110 100 M 106 96 L 110 100 L 114 96"
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    );
  }
  if (kind === "pin") {
    return (
      <svg width="100%" height="120" viewBox="0 0 220 120" className="block">
        <g>
          <rect
            x="20"
            y="44"
            width="40"
            height="32"
            rx="4"
            stroke={dim}
            strokeWidth={sw}
            fill="none"
            opacity={animate ? 0.45 : 0.85}
            style={{ transition: "opacity .4s" }}
          />
          <rect
            x="68"
            y="44"
            width="40"
            height="32"
            rx="4"
            stroke={animate ? stroke : dim}
            strokeWidth={sw}
            fill={animate ? "rgba(248,211,100,0.06)" : "none"}
            style={{ transition: "all .4s" }}
          />
          <rect
            x="116"
            y="44"
            width="40"
            height="32"
            rx="4"
            stroke={dim}
            strokeWidth={sw}
            fill="none"
            opacity={animate ? 0.45 : 0.85}
            style={{ transition: "opacity .4s" }}
          />
          <rect
            x="164"
            y="44"
            width="40"
            height="32"
            rx="4"
            stroke={dim}
            strokeWidth={sw}
            fill="none"
            opacity={animate ? 0.45 : 0.85}
            style={{ transition: "opacity .4s" }}
          />
        </g>
        <g
          style={{
            transform: animate ? "translateY(0)" : "translateY(4px)",
            transition: "transform .4s",
          }}
        >
          <path
            d="M 88 30 L 96 22 L 102 28 L 94 36 Z"
            fill={stroke}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <line
            x1="92"
            y1="34"
            x2="86"
            y2="40"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </g>
      </svg>
    );
  }
  if (kind === "forest") {
    return (
      <svg width="100%" height="120" viewBox="0 0 220 120" className="block">
        {[
          { x: 50, active: false },
          { x: 110, active: true },
          { x: 170, active: false },
        ].map((t, i) => (
          <g
            key={i}
            opacity={animate ? (t.active ? 1 : 0.32) : 0.7}
            style={{ transition: "opacity .5s" }}
          >
            <circle
              cx={t.x}
              cy={36}
              r="3"
              fill={t.active && animate ? stroke : dim}
            />
            <line
              x1={t.x}
              y1={36}
              x2={t.x - 16}
              y2={56}
              stroke={t.active && animate ? stroke : dim}
              strokeWidth={sw}
            />
            <line
              x1={t.x}
              y1={36}
              x2={t.x + 16}
              y2={56}
              stroke={t.active && animate ? stroke : dim}
              strokeWidth={sw}
            />
            <line
              x1={t.x}
              y1={36}
              x2={t.x}
              y2={62}
              stroke={t.active && animate ? stroke : dim}
              strokeWidth={sw}
            />
            <circle
              cx={t.x - 16}
              cy={56}
              r="2"
              fill={t.active && animate ? stroke : dim}
            />
            <circle
              cx={t.x + 16}
              cy={56}
              r="2"
              fill={t.active && animate ? stroke : dim}
            />
            <circle
              cx={t.x}
              cy={62}
              r="2"
              fill={t.active && animate ? stroke : dim}
            />
            <line
              x1={t.x - 16}
              y1={56}
              x2={t.x - 22}
              y2={78}
              stroke={t.active && animate ? stroke : dim}
              strokeWidth={sw}
            />
            <line
              x1={t.x - 16}
              y1={56}
              x2={t.x - 8}
              y2={78}
              stroke={t.active && animate ? stroke : dim}
              strokeWidth={sw}
            />
            <line
              x1={t.x + 16}
              y1={56}
              x2={t.x + 22}
              y2={78}
              stroke={t.active && animate ? stroke : dim}
              strokeWidth={sw}
            />
            <line
              x1={t.x + 16}
              y1={56}
              x2={t.x + 8}
              y2={78}
              stroke={t.active && animate ? stroke : dim}
              strokeWidth={sw}
            />
            <circle
              cx={t.x - 22}
              cy={78}
              r="1.5"
              fill={t.active && animate ? stroke : dim}
            />
            <circle
              cx={t.x - 8}
              cy={78}
              r="1.5"
              fill={t.active && animate ? stroke : dim}
            />
            <circle
              cx={t.x + 8}
              cy={78}
              r="1.5"
              fill={t.active && animate ? stroke : dim}
            />
            <circle
              cx={t.x + 22}
              cy={78}
              r="1.5"
              fill={t.active && animate ? stroke : dim}
            />
          </g>
        ))}
        <line
          x1="20"
          y1="92"
          x2="200"
          y2="92"
          stroke={dim}
          strokeWidth="0.8"
          strokeDasharray="2 4"
        />
      </svg>
    );
  }
  if (kind === "keys") {
    const keys = [
      { x: 32, label: "⌘" },
      { x: 78, label: "K" },
      { x: 124, label: "⌘" },
      { x: 170, label: "Z" },
    ];
    return (
      <svg width="100%" height="120" viewBox="0 0 220 120" className="block">
        {keys.map((k, i) => (
          <g key={i}>
            <rect
              x={k.x}
              y="42"
              width="36"
              height="36"
              rx="6"
              stroke={animate ? stroke : dim}
              fill={animate ? "rgba(248,211,100,0.08)" : "none"}
              strokeWidth={sw}
              style={{ transition: `all .35s ease ${i * 0.08}s` }}
            />
            <text
              x={k.x + 18}
              y="65"
              textAnchor="middle"
              fontSize="14"
              fontFamily="var(--font-mono)"
              fontWeight="500"
              fill={animate ? stroke : dim}
              style={{ transition: `fill .35s ease ${i * 0.08}s` }}
            >
              {k.label}
            </text>
          </g>
        ))}
      </svg>
    );
  }
  return null;
}

const easeOut = [0.23, 1, 0.32, 1] as const;

export function LandingFeatures() {
  const [hovered, setHovered] = useState<number | null>(null);
  const reduce = useReducedMotion();

  return (
    <section
      id="features"
      className="relative bg-[var(--landing-bg)] border-t border-[var(--landing-line)]"
      style={{
        padding: "clamp(96px, 14vh, 200px) clamp(24px, 6vw, 96px)",
        scrollMarginTop: "0",
      }}
    >
      <div className="mx-auto max-w-[1280px]" style={{ marginBottom: 96 }}>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: easeOut }}
        >
          <div
            className="font-mono uppercase mb-[22px]"
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "var(--landing-ember)",
            }}
          >
            What is in the box
          </div>
          <h2
            className="font-serif text-[var(--landing-ink)] max-w-[900px]"
            style={{
              fontSize: "clamp(40px, 5.5vw, 80px)",
              fontWeight: 400,
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
              textWrap: "balance" as React.CSSProperties["textWrap"],
            }}
          >
            The browser, but with{" "}
            <em
              style={{
                fontStyle: "italic",
                color: "var(--landing-ember)",
              }}
            >
              memory
            </em>
            .
          </h2>
          <p
            className="mt-7 max-w-[540px]"
            style={{
              fontSize: 17,
              lineHeight: 1.55,
              color: "rgba(246,239,225,0.65)",
            }}
          >
            Six things Trail does that your history page never could.
          </p>
        </motion.div>
      </div>

      <div
        className="mx-auto max-w-[1280px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        style={{
          gap: 1,
          background: "var(--landing-line)",
          border: "1px solid var(--landing-line)",
        }}
      >
        {FEATURES.map((f, i) => {
          const isHover = hovered === i;
          return (
            <motion.div
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: easeOut, delay: i * 0.06 }}
              className="relative flex flex-col"
              style={{
                background: isHover
                  ? "rgba(20, 17, 12, 0.85)"
                  : "var(--landing-bg)",
                padding: "clamp(28px, 3.2vw, 44px)",
                transition: "background .45s ease",
                minHeight: 380,
              }}
            >
              <div
                className="flex items-center"
                style={{
                  marginBottom: 36,
                  height: 120,
                  borderBottom: "1px solid var(--landing-line)",
                }}
              >
                <FeatureVisual kind={f.visual} animate={isHover} />
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  color: isHover
                    ? "var(--landing-ember)"
                    : "rgba(246,239,225,0.4)",
                  marginBottom: 16,
                  transition: "color .4s ease",
                }}
              >
                {f.eyebrow}
              </div>
              <h3
                className="font-serif text-[var(--landing-ink)]"
                style={{
                  fontSize: 26,
                  fontWeight: 500,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.1,
                  marginBottom: 14,
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  color: "rgba(246,239,225,0.62)",
                  maxWidth: 380,
                }}
              >
                {f.body}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
