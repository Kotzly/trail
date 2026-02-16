"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "motion/react";
import {
  Network,
  ZoomIn,
  GitBranchPlus,
  Search,
  Keyboard,
  SlidersHorizontal,
  Pin,
  Tag,
  ListTree,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";

/* ────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────── */

type OnboardingStatus = "pending" | "completed";

type OnboardingState = {
  flowId: string;
  status: OnboardingStatus;
  seenAt: string | null;
};

type Props = {
  initialStatus: OnboardingStatus;
};

/* ────────────────────────────────────────────────────────────
 * Step definitions — 5-step tour explaining Trail features.
 * ──────────────────────────────────────────────────────────── */

type StepId = "welcome" | "visualize" | "navigate" | "organize" | "ready";

type Detail = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  text: string;
};

type Step = {
  id: StepId;
  badge?: string;
  title: string;
  body: string;
  details?: Detail[];
};

const STEPS: Step[] = [
  {
    id: "welcome",
    title: "Welcome to Trail",
    body: "Trail maps your browsing into an interactive tree so you never lose context. Let\u2019s take a quick look at what it can do.",
  },
  {
    id: "visualize",
    badge: "Core feature",
    title: "Your browsing, visualized",
    body: "Every page you visit becomes a node in a live graph. See how your research branches and flows \u2014 automatically.",
    details: [
      { icon: Network, text: "Tree, mindmap & radial layouts" },
      { icon: ZoomIn, text: "Pan, zoom & explore freely" },
      { icon: GitBranchPlus, text: "Branches form as you browse" },
    ],
  },
  {
    id: "navigate",
    badge: "Power tools",
    title: "Find anything instantly",
    body: "Use search and keyboard shortcuts to navigate your browsing tree at lightning speed.",
    details: [
      { icon: Search, text: "Ctrl/\u2318+K \u2014 Quick search" },
      { icon: Keyboard, text: "Arrow keys to traverse nodes" },
      { icon: SlidersHorizontal, text: "Shift+L \u2014 Switch layout" },
    ],
  },
  {
    id: "organize",
    badge: "Stay focused",
    title: "Organize your trails",
    body: "Pin pages, tag nodes, and save separate trees for different projects or research topics.",
    details: [
      { icon: Pin, text: "Pin important pages for quick access" },
      { icon: Tag, text: "Tag nodes to filter & group" },
      { icon: ListTree, text: "Multiple trees for different projects" },
    ],
  },
  {
    id: "ready",
    title: "You\u2019re all set!",
    body: "Open the extension side panel and start browsing. Your tree builds itself \u2014 Trail will help you arrange it right away.",
  },
];

const TOTAL = STEPS.length;
const POLL_INTERVAL_MS = 2500;

/* ────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────── */

export default function OnboardingGate({ initialStatus }: Props) {
  const [status, setStatus] = useState<OnboardingStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = STEPS[currentStep]!;
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOTAL - 1;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    setStatus("completed");
    stopPolling();
  }, [stopPolling]);

  // Poll for external completion (e.g. user completed/skipped in extension)
  useEffect(() => {
    if (status !== "pending") return;

    const poll = async () => {
      try {
        const res = await fetch("/api/onboarding", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { onboarding?: OnboardingState };
        if (data.onboarding?.status === "completed") {
          dismiss();
        }
      } catch {
        // Silently ignore poll errors
      }
    };

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return stopPolling;
  }, [status, dismiss, stopPolling]);

  const handleComplete = useCallback(
    async (action: "complete" | "skip") => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, source: "web" }),
        });
        if (!res.ok) {
          throw new Error("Request failed");
        }
        dismiss();
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [dismiss],
  );

  const goNext = useCallback(() => {
    if (isLast) {
      void handleComplete("complete");
    } else {
      setDirection(1);
      setCurrentStep((s) => s + 1);
    }
  }, [isLast, handleComplete]);

  const goPrev = useCallback(() => {
    if (!isFirst) {
      setDirection(-1);
      setCurrentStep((s) => s - 1);
    }
  }, [isFirst]);

  if (status === "completed") {
    return null;
  }

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 60 : -60,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -60 : 60,
      opacity: 0,
    }),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-xl">
        {/* Card body */}
        <div className="relative min-h-[340px] px-8 pt-8 pb-4">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center text-center"
            >
              {/* Welcome step: logo */}
              {step.id === "welcome" && (
                <div className="mb-3 flex h-16 w-16 items-center justify-center">
                  <Image
                    src="/brand/trail-fork-dark.svg"
                    alt="Trail"
                    width={64}
                    height={64}
                    className="block dark:hidden"
                    priority
                  />
                  <Image
                    src="/brand/trail-fork-light.svg"
                    alt="Trail"
                    width={64}
                    height={64}
                    className="hidden dark:block"
                    priority
                  />
                </div>
              )}

              {/* Ready step: sparkle icon */}
              {step.id === "ready" && (
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Zap size={28} />
                </div>
              )}

              {/* Badge */}
              {step.badge && (
                <span className="mb-2 inline-block rounded-full border border-primary/20 bg-primary/10 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                  {step.badge}
                </span>
              )}

              {/* Title & body */}
              <h2 className="text-xl font-bold tracking-tight">
                {step.title}
              </h2>
              <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>

              {/* Feature details */}
              {step.details && (
                <ul className="mt-4 flex w-full max-w-[300px] flex-col gap-2">
                  {step.details.map((d) => {
                    const Icon = d.icon;
                    return (
                      <li
                        key={d.text}
                        className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 px-3 py-2.5 text-left text-[13px]"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon size={15} />
                        </span>
                        <span>{d.text}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: dots + navigation */}
        <div className="flex flex-col items-center gap-4 px-8 pb-8">
          {/* Dot indicators */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === currentStep
                    ? "w-5 bg-primary"
                    : i < currentStep
                      ? "w-1.5 bg-primary/40"
                      : "w-1.5 bg-foreground/15"
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex w-full items-center justify-center gap-2">
            {/* Skip — visible on all steps except last */}
            {!isLast && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleComplete("skip")}
                disabled={busy}
                className="text-muted-foreground"
              >
                Skip
              </Button>
            )}

            {/* Back */}
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={busy}
              >
                <ChevronLeft size={14} />
                Back
              </Button>
            )}

            {/* Next / Finish */}
            <Button
              size="sm"
              onClick={goNext}
              disabled={busy}
              className="min-w-[120px]"
            >
              {busy ? (
                "Saving…"
              ) : isLast ? (
                "Get started"
              ) : isFirst ? (
                <>
                  Take the tour
                  <ChevronRight size={14} className="ml-1" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight size={14} className="ml-1" />
                </>
              )}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
