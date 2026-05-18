"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Folder,
  Globe,
  Pin,
  Plus,
  Redo2,
  Search,
  Settings,
  Undo2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { FaviconKind } from "./Favicon";
import { TrailMark } from "./TrailMark";

export type DemoNode = {
  id: string;
  parent: string | null;
  favicon: FaviconKind;
  title: string;
  domain: string;
  page: string;
  pinned?: boolean;
  tabCount?: number;
};

// Tree layout — sidepanel 480px, graph area 480×420.
// Three even columns at card-left 30 / 174 / 318 give the bottom row
// equal gutters; wiki/arxiv center over their children, root over the tree.
const NODE_W = 132;
const NODE_H = 56;

// Graph design canvas. The sidepanel's NODE_POS coordinates are pixel-
// absolute on this fixed grid. On narrow viewports (phones) we scale
// the whole graph subtree to fit, leaving the floating chrome (top/
// bottom control buttons) at native size so tap targets stay finger-
// friendly. The inner content is *visually* shrunk; layout-wise the
// parent still gets full width, so the buttons line up over their
// usual positions.
const GRAPH_DESIGN_W = 480;
const GRAPH_DESIGN_H = 380;
const NODE_POS: Record<string, { x: number; y: number }> = {
  root: { x: 174, y: 60 },
  wiki: { x: 102, y: 174 },
  arxiv: { x: 318, y: 174 },
  so: { x: 30, y: 288 },
  yt: { x: 174, y: 288 },
  gh: { x: 318, y: 288 },
};

// Mirror of xyflow's default bezier edge path — stable hand-built cubic.
function buildPath(p: { x: number; y: number }, c: { x: number; y: number }) {
  const sourceX = p.x + NODE_W / 2;
  const sourceY = p.y + NODE_H;
  const targetX = c.x + NODE_W / 2;
  const targetY = c.y;
  const my = (sourceY + targetY) / 2;
  return `M ${sourceX} ${sourceY} C ${sourceX} ${my}, ${targetX} ${my}, ${targetX} ${targetY}`;
}

// Use Google's favicon service so demo nodes show *real* favicons,
// matching how the extension resolves them via getFaviconUrl().
function faviconURL(domain: string, size = 32) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

// Letter-pill fallback colors — used as initial bg under the favicon img,
// so even before the network-loaded favicon arrives the card looks right.
const FALLBACK_BG: Record<FaviconKind, string> = {
  newtab: "#3b3a36",
  wiki: "#ffffff",
  arxiv: "#b31b1b",
  so: "#f48024",
  yt: "#ff0033",
  gh: "#24292f",
};

function NodeFavicon({ kind, domain }: { kind: FaviconKind; domain: string }) {
  const [errored, setErrored] = useState(false);
  if (errored || kind === "newtab") {
    // newtab pages have no real favicon — use the small Trail glyph
    return (
      <Globe
        size={14}
        strokeWidth={1.75}
        className="shrink-0 text-[rgba(246,239,225,0.6)]"
        aria-hidden
      />
    );
  }
  return (
    // 14×14 favicon from Google's favicon service — next/image
    // would proxy through the optimizer for no win at this size.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={faviconURL(domain)}
      alt=""
      width={14}
      height={14}
      loading="lazy"
      onError={() => setErrored(true)}
      className="size-[14px] shrink-0 rounded-[2px]"
      style={{ background: FALLBACK_BG[kind] }}
    />
  );
}

// Mini-TrailNode — same idioms as extension/src/features/graph/components/TrailNode.tsx
function TrailNodeCard({
  node,
  isCurrent,
  isOnTrail,
  isHover,
  onClick,
  onMouseEnter,
  onMouseLeave,
  openLabel,
  pinnedLabel,
}: {
  node: DemoNode;
  isCurrent: boolean;
  isOnTrail: boolean;
  isHover: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  openLabel: string;
  pinnedLabel: string;
}) {
  const displayUrl = node.domain.replace(/^www\./, "");
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label={openLabel}
      className="absolute flex flex-row items-center gap-1.5 rounded-md border px-2 py-1.5 text-left transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out hover:scale-[1.015] active:scale-[0.985]"
      style={{
        left: `${NODE_POS[node.id].x}px`,
        top: `${NODE_POS[node.id].y}px`,
        width: NODE_W,
        height: NODE_H,
        background: isCurrent
          ? "rgba(248, 211, 100, 0.10)"
          : isHover
            ? "rgba(28, 22, 14, 0.95)"
            : "rgba(20, 17, 12, 0.78)",
        borderColor: isCurrent
          ? "rgba(248, 211, 100, 0.85)"
          : isOnTrail
            ? "rgba(248, 211, 100, 0.45)"
            : "rgba(246, 239, 225, 0.14)",
        boxShadow: isCurrent
          ? "0 0 0 1px rgba(248,211,100,0.55), 0 4px 14px rgba(0,0,0,0.45)"
          : isHover
            ? "0 4px 12px rgba(0,0,0,0.45)"
            : "0 2px 6px rgba(0,0,0,0.35)",
      }}
    >
      <NodeFavicon kind={node.favicon} domain={node.domain} />
      <div className="flex min-w-0 flex-1 flex-col gap-px text-left">
        <span
          className="line-clamp-2 leading-[1.15] font-medium"
          style={{
            fontSize: 10.5,
            color: isCurrent
              ? "var(--landing-ink)"
              : "rgba(246, 239, 225, 0.92)",
            letterSpacing: "-0.005em",
          }}
        >
          {node.title}
        </span>
        <span
          className="truncate font-mono leading-[1.1]"
          style={{ fontSize: 7.5, color: "rgba(246, 239, 225, 0.45)" }}
        >
          {displayUrl}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {node.tabCount && node.tabCount > 1 ? (
          <span
            className="grid h-3.5 min-w-[14px] place-items-center rounded font-mono tabular-nums"
            style={{
              fontSize: 8,
              padding: "0 3px",
              background: "rgba(248, 211, 100, 0.16)",
              color: "var(--landing-ember)",
              lineHeight: 1,
            }}
          >
            {node.tabCount}
          </span>
        ) : null}
        {node.pinned ? (
          <span
            className="grid h-3.5 w-3.5 place-items-center rounded"
            aria-label={pinnedLabel}
            style={{ color: "rgba(246, 239, 225, 0.65)" }}
          >
            <Pin size={9} strokeWidth={2} aria-hidden />
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function Sidepanel({
  nodes,
  activeId,
  onPick,
}: {
  nodes: DemoNode[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  const t = useTranslations("landing.demo.sidepanel");
  const [hovered, setHovered] = useState<string | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  // Continuous scale [0..1] driven by ResizeObserver on the graph column.
  // The fixed-pixel tree was designed for a 480px sidepanel; on phones the
  // column is narrower so we shrink. Default 1 keeps SSR matching desktop.
  const [graphScale, setGraphScale] = useState(1);
  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;
    const update = (w: number) => {
      const next = Math.min(1, w / GRAPH_DESIGN_W);
      // Quantize so we don't churn the transform on every sub-pixel tick.
      setGraphScale((prev) =>
        Math.abs(prev - next) < 0.005 ? prev : Math.round(next * 1000) / 1000,
      );
    };
    update(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) update(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const byId = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  // Trail = path from active to root (ancestor chain).
  const trail = useMemo(() => {
    const set = new Set<string>();
    let cur: string | null = activeId;
    while (cur) {
      set.add(cur);
      cur = byId[cur].parent;
    }
    return set;
  }, [activeId, byId]);

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden border-l border-[var(--landing-line)]"
      style={{
        background:
          "radial-gradient(circle at 50% 0%, rgba(248, 211, 100, 0.04) 0%, transparent 60%), linear-gradient(180deg, #0e0c08 0%, #14110c 100%)",
      }}
    >
      {/* Top floating controls — TreeDropdown on the left, search + settings on the right */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors duration-200 hover:bg-[rgba(246,239,225,0.06)]"
            style={{
              background: "rgba(20, 17, 12, 0.85)",
              border: "1px solid var(--landing-line-strong)",
            }}
            aria-label={t("switchTree")}
          >
            <TrailMark size={16} />
            <span className="font-serif text-[12.5px] font-medium text-[var(--landing-ink)]">
              {t("treeName")}
            </span>
            <ChevronDown
              size={12}
              strokeWidth={2}
              className="text-[rgba(246,239,225,0.55)]"
              aria-hidden
            />
          </button>
          <button
            className="grid h-[28px] w-[28px] place-items-center rounded-md transition-colors duration-200 hover:bg-[rgba(246,239,225,0.06)]"
            style={{
              background: "rgba(20, 17, 12, 0.85)",
              border: "1px solid var(--landing-line-strong)",
              color: "rgba(246, 239, 225, 0.7)",
            }}
            aria-label={t("pinned")}
          >
            <Pin size={12} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            className="flex h-[28px] items-center gap-1.5 rounded-md px-2 transition-colors duration-200 hover:bg-[rgba(246,239,225,0.06)]"
            style={{
              background: "rgba(20, 17, 12, 0.85)",
              border: "1px solid var(--landing-line-strong)",
              color: "rgba(246, 239, 225, 0.7)",
            }}
            aria-label={t("searchTrail")}
          >
            <Search size={12} strokeWidth={1.75} aria-hidden />
            <span
              className="font-mono"
              style={{ fontSize: 9.5, letterSpacing: "0.04em" }}
            >
              ⌘K
            </span>
          </button>
          <button
            className="grid h-[28px] w-[28px] place-items-center rounded-md transition-colors duration-200 hover:bg-[rgba(246,239,225,0.06)]"
            style={{
              background: "rgba(20, 17, 12, 0.85)",
              border: "1px solid var(--landing-line-strong)",
              color: "rgba(246, 239, 225, 0.7)",
            }}
            aria-label={t("settings")}
          >
            <Settings size={12} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>

      {/* Bottom-left floating: Undo / Redo */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-1.5">
        <div
          className="pointer-events-auto flex items-center divide-x divide-[var(--landing-line-strong)] overflow-hidden rounded-md"
          style={{
            background: "rgba(20, 17, 12, 0.85)",
            border: "1px solid var(--landing-line-strong)",
          }}
        >
          <button
            className="grid h-[26px] w-[26px] place-items-center text-[rgba(246,239,225,0.7)] transition-colors duration-200 hover:bg-[rgba(246,239,225,0.06)]"
            aria-label={t("undo")}
          >
            <Undo2 size={11} strokeWidth={1.75} aria-hidden />
          </button>
          <button
            className="grid h-[26px] w-[26px] place-items-center text-[rgba(246,239,225,0.7)] transition-colors duration-200 hover:bg-[rgba(246,239,225,0.06)]"
            aria-label={t("redo")}
          >
            <Redo2 size={11} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <button
          className="pointer-events-auto grid h-[26px] w-[26px] place-items-center rounded-md text-[rgba(246,239,225,0.7)] transition-colors duration-200 hover:bg-[rgba(246,239,225,0.06)]"
          style={{
            background: "rgba(20, 17, 12, 0.85)",
            border: "1px solid var(--landing-line-strong)",
          }}
          aria-label={t("newTabFromNode")}
        >
          <Plus size={12} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      {/* Bottom-right floating: trail count */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-20">
        <div
          className="pointer-events-auto flex items-center gap-1.5 rounded-md px-2 py-1"
          style={{
            background: "rgba(20, 17, 12, 0.85)",
            border: "1px solid var(--landing-line-strong)",
            color: "rgba(246, 239, 225, 0.55)",
          }}
        >
          <Folder size={11} strokeWidth={1.75} aria-hidden />
          <span
            className="font-mono"
            style={{ fontSize: 9.5, letterSpacing: "0.05em" }}
          >
            {t("nodes", { count: nodes.length })}
          </span>
        </div>
      </div>

      {/* Graph area — xyflow-style: dot pattern background, bezier edges, card nodes */}
      <div
        ref={graphRef}
        className="relative flex-1 overflow-hidden"
        style={{
          backgroundImage:
            "radial-gradient(rgba(246,239,225,0.07) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0",
        }}
      >
        {/* Scaled inner stage — fixed design canvas, transform: scale fits
            it into whatever width the parent column has on the current
            viewport. Centered both axes so the tree floats in the middle
            of the column when scaled down (no awkward empty band under it). */}
        <div
          className="absolute"
          style={{
            left: "50%",
            top: "50%",
            width: GRAPH_DESIGN_W,
            height: GRAPH_DESIGN_H,
            transformOrigin: "center center",
            transform: `translate(-50%, -50%) scale(${graphScale})`,
          }}
        >
          {/* Edges */}
          <svg
            width={GRAPH_DESIGN_W}
            height={GRAPH_DESIGN_H}
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
          >
            <defs>
              {/* userSpaceOnUse — without it, a perfectly vertical edge
                (e.g. arxiv → gh, both at x=318) has a zero-width bbox
                and the default `objectBoundingBox` gradient renders
                nothing, dropping the stroke entirely. */}
              <linearGradient
                id="trailEdge"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="60"
                x2="0"
                y2="344"
              >
                <stop offset="0%" stopColor="#f8d364" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#d2734e" stopOpacity="0.7" />
              </linearGradient>
              {/* Same userSpaceOnUse story as the gradient above: with
                the default `objectBoundingBox`, a perfectly vertical
                edge has zero-width bbox, so `160%` of zero is zero —
                the filter region collapses and the blurred stroke
                renders nothing. Anchor the region to the SVG canvas
                instead. */}
              <filter
                id="trailEdgeGlow"
                filterUnits="userSpaceOnUse"
                x="-50"
                y="-50"
                width="2000"
                height="2000"
              >
                <feGaussianBlur stdDeviation="1.6" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {nodes
              .filter((n) => n.parent)
              .map((n) => {
                const p = NODE_POS[n.parent!];
                const c = NODE_POS[n.id];
                const onTrail = trail.has(n.id) && trail.has(n.parent!);
                return (
                  <path
                    key={n.id}
                    d={buildPath(p, c)}
                    fill="none"
                    stroke={
                      onTrail ? "url(#trailEdge)" : "rgba(246, 239, 225, 0.16)"
                    }
                    strokeWidth={onTrail ? 1.6 : 1.2}
                    strokeLinecap="round"
                    filter={onTrail ? "url(#trailEdgeGlow)" : undefined}
                    style={{
                      transition: "stroke 80ms cubic-bezier(0.23,1,0.32,1)",
                    }}
                  />
                );
              })}
          </svg>

          {/* Node cards */}
          {nodes.map((n) => (
            <TrailNodeCard
              key={n.id}
              node={n}
              isCurrent={activeId === n.id}
              isOnTrail={trail.has(n.id)}
              isHover={hovered === n.id}
              onClick={() => onPick(n.id)}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              openLabel={t("openNodeAria", { title: n.title })}
              pinnedLabel={t("pinned")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
