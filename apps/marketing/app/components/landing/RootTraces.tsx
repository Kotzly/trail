"use client";

import { motion, type MotionValue, useTransform } from "motion/react";

// Lightweight scroll-driven SVG roots. Used as the visual fallback when
// the hero video is suppressed (slow networks, reduced motion) or while
// it's still being fetched. Pure SVG, ~1KB on the wire — provides real
// motion that mirrors the "root growing from a seed" metaphor instead
// of a frozen poster.
//
// Coordinates are 0..100 with preserveAspectRatio="none" so the tree
// stretches to whatever the section is. pathLength=100 normalizes each
// path's reported length, so a single dashoffset 100→0 reliably draws
// the stroke from start to end regardless of curve length.

type TraceDef = {
  d: string;
  range: [number, number]; // scroll progress window for the stroke draw
};

// Trunk first (down the spine), then symmetric branches splaying out at
// progressively deeper depths — matches the radial nodeDelay in
// RootNodes so the lines arrive in sync with the cards they connect.
const TRACES: TraceDef[] = [
  { d: "M50 22 Q50 55 50 95", range: [0.55, 0.7] }, // trunk

  { d: "M50 32 Q40 40 30 50", range: [0.6, 0.74] }, // L upper branch
  { d: "M50 32 Q60 40 70 50", range: [0.6, 0.74] }, // R upper branch

  { d: "M50 48 Q35 56 18 64", range: [0.66, 0.8] }, // L mid branch
  { d: "M50 48 Q65 56 82 64", range: [0.66, 0.8] }, // R mid branch

  { d: "M50 60 Q30 70 10 78", range: [0.72, 0.86] }, // L lower branch
  { d: "M50 60 Q70 70 90 78", range: [0.72, 0.86] }, // R lower branch

  { d: "M50 75 Q35 84 22 92", range: [0.78, 0.92] }, // L tip
  { d: "M50 75 Q65 84 78 92", range: [0.78, 0.92] }, // R tip

  { d: "M30 50 Q22 65 14 82", range: [0.74, 0.88] }, // L outer
  { d: "M70 50 Q78 65 86 82", range: [0.74, 0.88] }, // R outer
];

function Trace({
  d,
  range,
  progress,
}: {
  d: string;
  range: [number, number];
  progress: MotionValue<number>;
}) {
  const dashoffset = useTransform(progress, range, [100, 0], { clamp: true });
  return (
    <motion.path
      d={d}
      pathLength={100}
      strokeDasharray={100}
      strokeDashoffset={dashoffset}
      fill="none"
      stroke="rgba(248, 211, 100, 0.32)"
      strokeWidth={0.25}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  );
}

export function RootTraces({ progress }: { progress: MotionValue<number> }) {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        // Subtle additive glow so the traces feel emissive, not just lines.
        filter: "drop-shadow(0 0 4px rgba(248, 211, 100, 0.25))",
        mixBlendMode: "screen",
      }}
    >
      {/* Seed glow at the spawn point */}
      <circle
        cx={50}
        cy={22}
        r={0.6}
        fill="rgba(248, 211, 100, 0.9)"
        style={{
          filter: "drop-shadow(0 0 3px rgba(248, 211, 100, 1))",
        }}
      >
        <animate
          attributeName="r"
          values="0.5;0.85;0.5"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </circle>
      {TRACES.map((t, i) => (
        <Trace key={i} d={t.d} range={t.range} progress={progress} />
      ))}
    </svg>
  );
}
