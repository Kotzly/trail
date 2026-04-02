"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  PuzzleIcon,
  GitFork,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "./mutations";

interface OnboardingFlowProps {
  userId: string;
}

interface Step {
  id: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta?: React.ReactNode;
}

const STEPS: Step[] = [
  {
    id: 1,
    icon: <Sparkles className="h-10 w-10 text-primary" />,
    title: "Welcome to Trail!",
    description:
      "Trail captures your browsing as living tree structures — every tab, every navigation, every detour. Instead of a flat history list, you get a map of how you actually explored the web.",
  },
  {
    id: 2,
    icon: <PuzzleIcon className="h-10 w-10 text-primary" />,
    title: "Install the Extension",
    description:
      "The Trail browser extension runs quietly in the background and records your navigation trees in real time. It takes about 30 seconds to install.",
    cta: (
      <a
        href="https://chromewebstore.google.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
      >
        Open Chrome Web Store
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    ),
  },
  {
    id: 3,
    icon: <GitFork className="h-10 w-10 text-primary" />,
    title: "Your First Trail",
    description:
      "Once the extension is installed, just browse normally. Every time you open a new tab or follow a link, Trail grows a new branch. Come back here to see your trails take shape.",
  },
  {
    id: 4,
    icon: <CheckCircle2 className="h-10 w-10 text-emerald-500" />,
    title: "You're all set!",
    description:
      "Your account is ready. Head to the dashboard to see your trails, manage settings, and explore your browsing history like never before.",
  },
];

const TOTAL = STEPS.length;

export function OnboardingFlow({ userId: _userId }: OnboardingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0-indexed
  const [isPending, startTransition] = useTransition();

  const current = STEPS[step];
  const isLast = step === TOTAL - 1;

  async function finish() {
    startTransition(async () => {
      await completeOnboarding();
      router.push("/trails");
    });
  }

  function handleNext() {
    if (isLast) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleSkip() {
    finish();
  }

  return (
    <div className="w-full max-w-md">
      {/* Step dots */}
      <div className="flex items-center justify-center gap-2 mb-10">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Step ${i + 1}`}
            onClick={() => i < step && setStep(i)}
            className={cn(
              "rounded-full transition-all duration-300",
              i === step
                ? "h-2.5 w-8 bg-primary"
                : i < step
                  ? "h-2 w-2 bg-primary/50 cursor-pointer hover:bg-primary/70"
                  : "h-2 w-2 bg-muted-foreground/20",
            )}
          />
        ))}
      </div>

      {/* Card */}
      <div
        key={step}
        className="rounded-2xl border border-border/60 bg-card shadow-xl px-8 py-10 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300"
      >
        {/* Icon */}
        <div className="flex justify-center">{current.icon}</div>

        {/* Step counter */}
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Step {step + 1} of {TOTAL}
        </p>

        {/* Title */}
        <h1 className="text-2xl font-semibold tracking-tight">{current.title}</h1>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {current.description}
        </p>

        {/* Optional inline CTA (e.g. link to store) */}
        {current.cta && <div>{current.cta}</div>}

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-2">
          <Button
            onClick={handleNext}
            disabled={isPending}
            className="w-full gap-2"
            size="lg"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isLast ? (
              <>
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          {!isLast && (
            <button
              type="button"
              onClick={handleSkip}
              disabled={isPending}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
