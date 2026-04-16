import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@ui/components/ui/dialog";
import { Button } from "@ui/components/ui/button";
import { Progress } from "@ui/components/ui/progress";
import TrailLogo from "@ui/components/trail-logo";
import { Icons } from "../components/Icon.js";
import {
  advanceOnboarding,
  completeOnboarding,
  getOnboardingState,
  loadDemoTree,
  skipOnboarding,
  startOnboarding,
} from "../../api/onboarding.js";
import { showOperationError } from "../shared/show-operation-error.js";

type Step = {
  title: string;
  body: React.ReactNode;
  primaryLabel: string;
  primaryAction: "next" | "load-demo" | "done";
  secondaryLabel?: string;
  secondaryAction?: "skip" | "next";
};

const STEPS: Step[] = [
  {
    title: "Welcome to Trail",
    body: (
      <div className="flex flex-col gap-3 text-sm leading-relaxed">
        <p>
          Trail turns your browsing into an interactive <strong>graph</strong>. Every click,
          back-button, and new tab becomes a node you can revisit and rearrange.
        </p>
        <p className="text-muted-foreground">
          Your data stays on your device until you opt in to cloud sync.
        </p>
      </div>
    ),
    primaryLabel: "Next",
    primaryAction: "next",
    secondaryLabel: "Skip",
    secondaryAction: "skip",
  },
  {
    title: "How Trail works",
    body: (
      <div className="flex flex-col gap-3 text-sm leading-relaxed">
        <p>
          As you browse, Trail records <strong>URL, title, and favicon</strong> for each page —
          nothing else. No keystrokes, no form contents, no passwords.
        </p>
        <p>
          When you follow a link from a page, that page becomes the parent of the new one. Hit back
          and jump forward again — Trail forks a branch, so you don't lose the other path.
        </p>
        <p className="text-muted-foreground">
          The result: a visual map of your research, not a flat list.
        </p>
      </div>
    ),
    primaryLabel: "Next",
    primaryAction: "next",
    secondaryLabel: "Skip",
    secondaryAction: "skip",
  },
  {
    title: "Chrome will ask for permissions",
    body: (
      <div className="flex flex-col gap-3 text-sm leading-relaxed">
        <p>We need three permissions to build your trail:</p>
        <ul className="flex flex-col gap-2 pl-4">
          <li>
            <strong>webNavigation</strong> — detect when you navigate between pages so we can
            connect them in the graph.
          </li>
          <li>
            <strong>tabs</strong> — know which tab you're in so separate research sessions stay
            separate.
          </li>
          <li>
            <strong>storage</strong> — save your tree locally (no server unless you opt in).
          </li>
        </ul>
        <p className="text-muted-foreground">Trail never reads page content or form input.</p>
      </div>
    ),
    primaryLabel: "Got it",
    primaryAction: "next",
    secondaryLabel: "Skip",
    secondaryAction: "skip",
  },
  {
    title: "Try a demo tree?",
    body: (
      <div className="flex flex-col gap-3 text-sm leading-relaxed">
        <p>
          Want to see what a full research session looks like? Load a demo tree —{" "}
          <em>Planning a trip to Japan</em> — with ~25 nodes you can pan, collapse, and edit.
        </p>
        <p className="text-muted-foreground">
          Your current tree (if any) is archived, not deleted. Access it from the tree switcher.
        </p>
      </div>
    ),
    primaryLabel: "Load demo",
    primaryAction: "load-demo",
    secondaryLabel: "Skip, start fresh",
    secondaryAction: "next",
  },
  {
    title: "You're set!",
    body: (
      <div className="flex flex-col gap-3 text-sm leading-relaxed">
        <p>A few shortcuts to remember:</p>
        <ul className="flex flex-col gap-2 pl-4">
          <li>
            <kbd className="bg-muted rounded px-1.5 py-0.5 text-[11px]">⌘K</kbd> — Command palette
            (search across all nodes)
          </li>
          <li>
            <kbd className="bg-muted rounded px-1.5 py-0.5 text-[11px]">⌘Z</kbd> — Undo (last 30
            actions saved)
          </li>
          <li>
            <kbd className="bg-muted rounded px-1.5 py-0.5 text-[11px]">⌘/</kbd> — Full shortcuts
            cheat-sheet
          </li>
          <li>
            <kbd className="bg-muted rounded px-1.5 py-0.5 text-[11px]">F2</kbd> — Rename selected
            node
          </li>
        </ul>
        <p className="text-muted-foreground">Happy trailing 🌲</p>
      </div>
    ),
    primaryLabel: "Done",
    primaryAction: "done",
  },
];

export default function OnboardingWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getOnboardingState().then((state) => {
      if (cancelled) return;
      if (!state.seenWelcome) {
        setOpen(true);
        void startOnboarding();
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const goToStep = useCallback(async (nextStep: number) => {
    setStep(nextStep);
    await advanceOnboarding(nextStep);
  }, []);

  const handleSkip = useCallback(async () => {
    await skipOnboarding();
    setOpen(false);
  }, []);

  const handleDone = useCallback(async () => {
    await completeOnboarding();
    setOpen(false);
  }, []);

  const handleLoadDemo = useCallback(async () => {
    setBusy(true);
    try {
      await loadDemoTree();
      await goToStep(STEPS.length - 1);
    } catch (error) {
      showOperationError("Load demo tree", error);
    } finally {
      setBusy(false);
    }
  }, [goToStep]);

  const current = STEPS[step] ?? STEPS[0]!;
  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const isLast = step === STEPS.length - 1;

  const runPrimary = useCallback(async () => {
    if (busy) return;
    switch (current.primaryAction) {
      case "next":
        await goToStep(step + 1);
        break;
      case "load-demo":
        await handleLoadDemo();
        break;
      case "done":
        await handleDone();
        break;
    }
  }, [busy, current.primaryAction, goToStep, handleDone, handleLoadDemo, step]);

  const runSecondary = useCallback(async () => {
    if (busy) return;
    switch (current.secondaryAction) {
      case "skip":
        await handleSkip();
        break;
      case "next":
        await goToStep(step + 1);
        break;
    }
  }, [busy, current.secondaryAction, goToStep, handleSkip, step]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void handleSkip();
      }}
    >
      <DialogContent className="max-w-[440px] gap-4 p-0">
        <DialogHeader className="flex flex-col gap-2 p-6 pb-0">
          <div className="flex items-center justify-between gap-2">
            <TrailLogo className="size-8" label="Trail" />
            <span className="text-muted-foreground text-[11px]">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <Progress value={progress} className="h-1" />
          <AnimatePresence mode="wait">
            <motion.div
              key={`title-${step}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <DialogTitle className="text-lg font-semibold tracking-tight">
                {current.title}
              </DialogTitle>
            </motion.div>
          </AnimatePresence>
        </DialogHeader>
        <AnimatePresence mode="wait">
          <motion.div
            key={`body-${step}`}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="px-6 text-sm"
          >
            {current.body}
          </motion.div>
        </AnimatePresence>
        <div className="flex items-center justify-between gap-2 border-t p-4">
          {current.secondaryLabel ? (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={busy}
              onClick={() => void runSecondary()}
            >
              {current.secondaryLabel}
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant={isLast ? "default" : "default"}
            size="sm"
            type="button"
            disabled={busy}
            onClick={() => void runPrimary()}
          >
            {busy ? (
              <>
                <Icons.Loader2 className="size-3.5 animate-spin" />
                <span>Loading…</span>
              </>
            ) : (
              <span>{current.primaryLabel}</span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
