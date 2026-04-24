/**
 * Per-persona animated mini-visuals for screen 4 (Solution). Each
 * persona gets a different metaphor so the promise is reinforced
 * visually, not just copy-wise:
 *
 *   - research: branching — two parallel paths from one root
 *   - article: a single prominent node (the "found again" moment)
 *   - learning: a vertical chain — depth of a preserved thread
 *   - tabs: a scattered cluster — many tabs, all addressable
 *
 * All share the same node/edge visual grammar (radial glow + pulse +
 * stroke-dashoffset on edges) so transitions between personas on
 * back-nav feel coherent rather than whiplash.
 */

import "../components/branch-diagram.css";
import type { OnboardingPersona } from "@shared/config/storage-items.js";

const W = 260;
const H = 96;
const NODE_R = 7;
const GLOW_R = 14;

function NodeAndGlow({
  x,
  y,
  delay,
  r = NODE_R,
  glowR = GLOW_R,
  glowId,
}: {
  x: number;
  y: number;
  delay: number;
  r?: number;
  glowR?: number;
  glowId: string;
}) {
  return (
    <g>
      <circle
        className="branch-diagram__glow"
        style={{ animationDelay: `${delay}ms`, transformOrigin: `${x}px ${y}px` }}
        cx={x}
        cy={y}
        r={glowR}
        fill={`url(#${glowId})`}
      />
      <circle
        className="branch-diagram__node"
        style={{ animationDelay: `${delay}ms`, transformOrigin: `${x}px ${y}px` }}
        cx={x}
        cy={y}
        r={r}
        fill="var(--card)"
        stroke="var(--primary)"
        strokeWidth="2"
      />
    </g>
  );
}

function Edge({ d, delay, opacity = 1 }: { d: string; delay: number; opacity?: number }) {
  return (
    <path
      className="branch-diagram__edge"
      style={{ animationDelay: `${delay}ms` }}
      d={d}
      stroke="var(--ring)"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
      pathLength="1"
      opacity={opacity}
    />
  );
}

function Frame({
  children,
  glowId,
  ariaLabel,
}: {
  children: React.ReactNode;
  glowId: string;
  ariaLabel: string;
}) {
  return (
    <div
      className="bg-muted/40 border-border/60 relative overflow-hidden rounded-lg border"
      aria-hidden
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="branch-diagram block h-auto w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
            <stop offset="70%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {children}
      </svg>
    </div>
  );
}

// ── research: parallel paths ─────────────────────────────────────────
function ResearchVisual() {
  const root = { x: 130, y: 22 };
  const left = { x: 68, y: 70 };
  const right = { x: 192, y: 70 };
  return (
    <Frame glowId="solutionVisual-research" ariaLabel="Two paths preserved">
      <Edge
        d={`M ${root.x} ${root.y + NODE_R} C ${root.x - 10} ${root.y + 28}, ${left.x + 10} ${left.y - 28}, ${left.x} ${left.y - NODE_R}`}
        delay={220}
      />
      <Edge
        d={`M ${root.x} ${root.y + NODE_R} C ${root.x + 10} ${root.y + 28}, ${right.x - 10} ${right.y - 28}, ${right.x} ${right.y - NODE_R}`}
        delay={220}
      />
      <NodeAndGlow {...root} delay={0} glowId="solutionVisual-research" />
      <NodeAndGlow {...left} delay={500} glowId="solutionVisual-research" />
      <NodeAndGlow {...right} delay={500} glowId="solutionVisual-research" />
    </Frame>
  );
}

// ── article: one focused node in a haystack ─────────────────────────
function ArticleVisual() {
  // A loose scatter of muted dots + one central prominent node.
  const scatter = [
    { x: 40, y: 30, r: 3 },
    { x: 70, y: 64 },
    { x: 92, y: 18 },
    { x: 170, y: 18, r: 3 },
    { x: 200, y: 62 },
    { x: 224, y: 32, r: 3 },
  ];
  const focus = { x: 130, y: 46 };
  return (
    <Frame glowId="solutionVisual-article" ariaLabel="One node found among many">
      {scatter.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={n.r ?? 4}
          fill="var(--muted-foreground)"
          opacity={0.28}
          className="branch-diagram__node"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
      {/* Double-ring focus — emulates the "found it" moment */}
      <circle
        cx={focus.x}
        cy={focus.y}
        r={18}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity={0.45}
        className="branch-diagram__fork"
        style={{ animationDelay: "700ms" }}
      />
      <NodeAndGlow
        x={focus.x}
        y={focus.y}
        delay={420}
        r={9}
        glowR={20}
        glowId="solutionVisual-article"
      />
    </Frame>
  );
}

// ── learning: vertical chain, depth of a preserved thread ───────────
function LearningVisual() {
  const xs = 130;
  const ys = [16, 40, 64, 84];
  return (
    <Frame glowId="solutionVisual-learning" ariaLabel="A vertical chain of nodes">
      {ys.slice(0, -1).map((y, i) => {
        const next = ys[i + 1]!;
        return (
          <Edge
            key={i}
            d={`M ${xs} ${y + NODE_R} L ${xs} ${next - NODE_R}`}
            delay={200 + i * 260}
          />
        );
      })}
      {ys.map((y, i) => (
        <NodeAndGlow
          key={i}
          x={xs}
          y={y}
          delay={i * 260}
          r={i === 0 ? NODE_R : i === ys.length - 1 ? NODE_R + 1 : NODE_R - 1}
          glowId="solutionVisual-learning"
        />
      ))}
    </Frame>
  );
}

// ── tabs: a cluster with one pulsing highlight ─────────────────────
function TabsVisual() {
  // Grid-ish scatter of 8 nodes; one highlighted.
  const nodes = [
    { x: 46, y: 22 },
    { x: 90, y: 18 },
    { x: 134, y: 24 },
    { x: 178, y: 20 },
    { x: 222, y: 28 },
    { x: 60, y: 62 },
    { x: 104, y: 70 },
    { x: 216, y: 70 },
  ];
  const highlight = { x: 160, y: 66 };
  return (
    <Frame glowId="solutionVisual-tabs" ariaLabel="A cluster of nodes with one highlighted">
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={5}
          fill="var(--muted-foreground)"
          opacity={0.32}
          className="branch-diagram__node"
          style={{ animationDelay: `${80 + i * 55}ms` }}
        />
      ))}
      {/* Subtle connective lines suggesting "addressable" — three */}
      <Edge
        d={`M ${nodes[1]!.x} ${nodes[1]!.y} Q ${highlight.x - 20} ${(nodes[1]!.y + highlight.y) / 2}, ${highlight.x - 6} ${highlight.y - 4}`}
        delay={560}
        opacity={0.55}
      />
      <Edge
        d={`M ${nodes[4]!.x} ${nodes[4]!.y} Q ${highlight.x + 10} ${(nodes[4]!.y + highlight.y) / 2}, ${highlight.x + 4} ${highlight.y - 4}`}
        delay={620}
        opacity={0.55}
      />
      <NodeAndGlow
        x={highlight.x}
        y={highlight.y}
        delay={500}
        r={8}
        glowR={18}
        glowId="solutionVisual-tabs"
      />
    </Frame>
  );
}

export function SolutionVisual({ persona }: { persona: OnboardingPersona | null }) {
  switch (persona) {
    case "article":
      return <ArticleVisual />;
    case "learning":
      return <LearningVisual />;
    case "tabs":
      return <TabsVisual />;
    case "research":
    default:
      return <ResearchVisual />;
  }
}
