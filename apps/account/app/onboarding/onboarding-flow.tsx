"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Network,
  ZoomIn,
  GitBranchPlus,
  Search,
  Keyboard,
  SlidersHorizontal,
  Zap,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/* ─── Types ───────────────────────────────────────────────── */

type OnboardingStatus = "pending" | "completed";

type OnboardingState = {
  flowId: string;
  status: OnboardingStatus;
  seenAt: string | null;
};

/* ─── Steps ───────────────────────────────────────────────── */

type Feature = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
};

type Step = {
  id: string;
  eyebrow?: string;
  title: string;
  body: string;
  features?: Feature[];
};

const STEPS: Step[] = [
  {
    id: "welcome",
    title: "welcome to trail",
    body: "Trail turns your browsing into an interactive tree so you never lose context.",
  },
  {
    id: "visualize",
    eyebrow: "core feature",
    title: "your browsing, visualized",
    body: "Every page becomes a node in a live graph. Watch your research branch and flow \u2014 automatically.",
    features: [
      { icon: Network, label: "Tree, mindmap & radial layouts" },
      { icon: ZoomIn, label: "Pan, zoom & explore freely" },
      { icon: GitBranchPlus, label: "Branches form as you browse" },
    ],
  },
  {
    id: "navigate",
    eyebrow: "power tools",
    title: "find anything instantly",
    body: "Use search and keyboard shortcuts to navigate your browsing tree at lightning speed.",
  },
  {
    id: "ready",
    title: "you\u2019re all set",
    body: "Open the extension side panel and start browsing. Your tree builds itself.",
  },
];

const TOTAL = STEPS.length;
const POLL_MS = 2500;

/* ─── Growing tree ────────────────────────────────────────── */

type TreeNode = { x: number; y: number; r: number; root?: boolean };
type TreeEdge = [number, number];

const ALL_NODES: TreeNode[] = [
  { x: 150, y: 20, r: 10, root: true },
  { x: 80, y: 75, r: 7 },
  { x: 220, y: 70, r: 7 },
  { x: 40, y: 130, r: 6 },
  { x: 110, y: 135, r: 6 },
  { x: 250, y: 125, r: 6 },
  { x: 15, y: 180, r: 5 },
  { x: 225, y: 175, r: 5 },
  { x: 275, y: 175, r: 5 },
];

const ALL_EDGES: TreeEdge[] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [1, 4],
  [2, 5],
  [3, 6],
  [5, 7],
  [5, 8],
];

// Which nodes/edges are visible at each step
const STEP_VISIBLE_NODES = [
  [0],                          // Step 1: root only
  [0, 1, 2],                   // Step 2: root + 2 children
  [0, 1, 2, 3, 4, 5],          // Step 3: + 3 more
  [0, 1, 2, 3, 4, 5, 6, 7, 8], // Step 4: full tree
];

const STEP_VISIBLE_EDGES = [
  [],                            // Step 1: no edges
  [0, 1],                       // Step 2: root to children
  [0, 1, 2, 3, 4],              // Step 3: + deeper
  [0, 1, 2, 3, 4, 5, 6, 7],     // Step 4: all edges
];

function edgePath(fromIdx: number, toIdx: number): string {
  const f = ALL_NODES[fromIdx]!;
  const t = ALL_NODES[toIdx]!;
  const y1 = f.y + f.r;
  const y2 = t.y - t.r;
  const mid = (y1 + y2) / 2;
  return `M ${f.x} ${y1} C ${f.x} ${mid}, ${t.x} ${mid}, ${t.x} ${y2}`;
}

function GrowingTree({ step }: { step: number }) {
  const visibleNodes = STEP_VISIBLE_NODES[step] ?? [];
  const visibleEdges = STEP_VISIBLE_EDGES[step] ?? [];

  return (
    <svg
      viewBox="0 0 300 200"
      className="mx-auto h-full w-full max-w-[280px] lg:max-w-none"
      aria-hidden="true"
    >
      {/* Glow behind root */}
      <motion.circle
        cx={ALL_NODES[0]!.x}
        cy={ALL_NODES[0]!.y}
        r={24}
        className="fill-primary/8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />

      {/* Edges */}
      {ALL_EDGES.map(([from, to], i) => {
        const isVisible = visibleEdges.includes(i);
        return (
          <motion.path
            key={`e-${i}`}
            d={edgePath(from, to)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            className="text-border"
            initial={false}
            animate={{
              pathLength: isVisible ? 1 : 0,
              opacity: isVisible ? 1 : 0,
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        );
      })}

      {/* Nodes */}
      {ALL_NODES.map((node, i) => {
        const isVisible = visibleNodes.includes(i);
        return (
          <motion.circle
            key={`n-${i}`}
            cx={node.x}
            cy={node.y}
            r={node.r}
            className={node.root ? "fill-primary" : "fill-muted-foreground/40"}
            initial={false}
            animate={{
              opacity: isVisible ? 1 : 0,
              scale: isVisible ? 1 : 0,
            }}
            transition={{
              duration: 0.4,
              type: "spring",
              stiffness: 300,
              damping: 25,
            }}
            style={{ transformOrigin: `${node.x}px ${node.y}px` }}
          />
        );
      })}
    </svg>
  );
}

/* ─── Slide variants ──────────────────────────────────────── */

const slideVariants = {
  enter: (d: number) => ({ y: d > 0 ? 30 : -30, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (d: number) => ({ y: d > 0 ? -30 : 30, opacity: 0 }),
};

/* ─── Component ───────────────────────────────────────────── */

export function OnboardingFlow() {
  const [status, setStatus] = useState<OnboardingStatus>("pending");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissedRef = useRef(false);

  const [platform, setPlatform] = useState<"mac" | "other">("other");
  useEffect(() => {
    if (/mac|iphone|ipad/i.test(navigator.userAgent)) setPlatform("mac");
  }, []);

  const navigateFeatures: Feature[] = useMemo(() => {
    const mod = platform === "mac" ? "\u2318" : "Ctrl+";
    const shift = platform === "mac" ? "\u21e7" : "Shift+";
    return [
      { icon: Search, label: `${mod}K \u2014 Quick search` },
      { icon: Keyboard, label: "\u2190\u2191\u2192\u2193 \u2014 Navigate nodes" },
      { icon: SlidersHorizontal, label: `${shift}L \u2014 Switch layout` },
    ];
  }, [platform]);

  const current = STEPS[step]!;
  const stepFeatures =
    current.id === "navigate" ? navigateFeatures : current.features;
  const isFirst = step === 0;
  const isLast = step === TOTAL - 1;

  /* ── Polling ── */

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setStatus("completed");
    stopPolling();
    window.location.href = "/trails";
  }, [stopPolling]);

  useEffect(() => {
    if (status !== "pending") return;

    const poll = async () => {
      try {
        const res = await fetch("/api/onboarding", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { onboarding?: OnboardingState };
        if (data.onboarding?.status === "completed") dismiss();
      } catch {
        /* ignore */
      }
    };

    pollRef.current = setInterval(poll, POLL_MS);
    return stopPolling;
  }, [status, dismiss, stopPolling]);

  /* ── Actions ── */

  const complete = useCallback(
    async (action: "complete" | "skip") => {
      setBusy(true);
      setError(null);
      stopPolling(); // prevent polling from racing with this POST
      try {
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, source: "web" }),
        });
        if (!res.ok) throw new Error("Request failed");
        const data = (await res.json()) as { onboarding?: OnboardingState };
        if (data.onboarding?.status !== "completed") {
          throw new Error("Onboarding was not marked as completed");
        }
        dismiss();
      } catch {
        setError("Something went wrong. Please try again.");
        // restart polling only if still pending (POST failed)
        if (!dismissedRef.current) {
          pollRef.current = setInterval(async () => {
            try {
              const res = await fetch("/api/onboarding", { cache: "no-store" });
              if (!res.ok) return;
              const data = (await res.json()) as { onboarding?: OnboardingState };
              if (data.onboarding?.status === "completed") dismiss();
            } catch { /* ignore */ }
          }, POLL_MS);
        }
      } finally {
        setBusy(false);
      }
    },
    [dismiss, stopPolling],
  );

  const goNext = useCallback(() => {
    if (isLast) {
      void complete("complete");
    } else {
      setDir(1);
      setStep((s) => s + 1);
    }
  }, [isLast, complete]);

  const goPrev = useCallback(() => {
    if (!isFirst) {
      setDir(-1);
      setStep((s) => s - 1);
    }
  }, [isFirst]);

  /* ── Keyboard ── */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (busy) return;
      if (e.key === "ArrowRight") {
        setDir(1);
        setStep((s) => Math.min(s + 1, TOTAL - 1));
      } else if (e.key === "ArrowLeft") {
        setDir(-1);
        setStep((s) => Math.max(s - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy]);

  if (status === "completed") return null;

  /* ── Render ── */

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Card className="mx-auto w-full max-w-4xl border-0 shadow-none lg:border lg:shadow-sm">
        <div className="grid lg:grid-cols-2">
          {/* Left: Growing tree */}
          <div className="flex items-center justify-center bg-muted/30 p-8 lg:rounded-l-lg lg:p-12">
            <div className="w-full max-w-[260px] lg:max-w-[300px]">
              {/* Logo */}
              <div className="mb-6 flex justify-center">
                <Image
                  src="/brand/trail-fork-dark.svg"
                  alt="Trail"
                  width={40}
                  height={40}
                  className="block dark:hidden"
                  priority
                />
                <Image
                  src="/brand/trail-fork-light.svg"
                  alt="Trail"
                  width={40}
                  height={40}
                  className="hidden dark:block"
                  priority
                />
              </div>
              <GrowingTree step={step} />
            </div>
          </div>

          {/* Right: Content */}
          <div className="flex flex-col">
            {/* Progress bar */}
            <div className="h-1 bg-secondary">
              <motion.div
                className="h-full bg-primary"
                animate={{ width: `${((step + 1) / TOTAL) * 100}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>

            <CardHeader>
              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={current.id}
                  custom={dir}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  {current.eyebrow && (
                    <CardDescription className="mb-2 text-xs font-semibold uppercase tracking-wider">
                      {current.eyebrow}
                    </CardDescription>
                  )}
                  <CardTitle>{current.title}</CardTitle>
                  <CardDescription className="mt-2">
                    {current.body}
                  </CardDescription>
                </motion.div>
              </AnimatePresence>
            </CardHeader>

            <CardContent className="flex-1">
              <AnimatePresence mode="wait">
                {stepFeatures && (
                  <motion.ul
                    key={`features-${current.id}`}
                    className="flex flex-col gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {stepFeatures.map((feat, i) => {
                      const Icon = feat.icon;
                      return (
                        <motion.li
                          key={feat.label}
                          className="flex items-center gap-3 rounded-lg border bg-secondary/40 p-3 text-sm"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.08 + i * 0.06, duration: 0.3 }}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Icon size={16} />
                          </span>
                          <span className="text-muted-foreground">
                            {feat.label}
                          </span>
                        </motion.li>
                      );
                    })}
                  </motion.ul>
                )}

                {current.id === "ready" && (
                  <motion.div
                    className="flex justify-center py-4"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 20,
                    }}
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Zap size={28} />
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>

            <CardFooter className="flex-col gap-4">
              {/* Step dots */}
              <div
                className="flex items-center gap-1.5"
                role="group"
                aria-label="Onboarding progress"
              >
                <span className="sr-only">
                  Step {step + 1} of {TOTAL}
                </span>
                {STEPS.map((s, i) => (
                  <motion.span
                    key={s.id}
                    className="rounded-full bg-primary"
                    aria-hidden="true"
                    animate={{
                      width: i === step ? 20 : 6,
                      height: 6,
                      opacity: i === step ? 1 : i < step ? 0.4 : 0.15,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                ))}
              </div>

              {/* Navigation */}
              <div className="flex w-full items-center justify-center gap-2">
                {!isLast && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void complete("skip")}
                    disabled={busy}
                    className="text-muted-foreground"
                  >
                    Skip
                  </Button>
                )}

                {!isFirst && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goPrev}
                    disabled={busy}
                  >
                    Back
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={goNext}
                  disabled={busy}
                  className="min-w-[140px]"
                >
                  {busy ? (
                    "Saving\u2026"
                  ) : isLast ? (
                    "Start exploring"
                  ) : (
                    <>
                      {isFirst ? "Take the tour" : "Next"}
                      <ChevronRight size={14} className="ml-1" />
                    </>
                  )}
                </Button>
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </CardFooter>
          </div>
        </div>
      </Card>
    </main>
  );
}
