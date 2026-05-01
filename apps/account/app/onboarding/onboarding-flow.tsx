"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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

type StepKey = "welcome" | "install" | "firstTrail" | "done";

const STEP_KEYS: StepKey[] = ["welcome", "install", "firstTrail", "done"];

const STEP_ICONS: Record<StepKey, React.ReactNode> = {
  welcome: <Sparkles className="h-10 w-10 text-primary" />,
  install: <PuzzleIcon className="h-10 w-10 text-primary" />,
  firstTrail: <GitFork className="h-10 w-10 text-primary" />,
  done: <CheckCircle2 className="h-10 w-10 text-emerald-500" />,
};

const TOTAL = STEP_KEYS.length;

export function OnboardingFlow({ userId: _userId }: OnboardingFlowProps) {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();

  const currentKey = STEP_KEYS[step]!;
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
        {STEP_KEYS.map((key, i) => (
          <button
            key={key}
            type="button"
            aria-label={t("stepAriaLabel", { index: i + 1 })}
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
        <div className="flex justify-center">{STEP_ICONS[currentKey]}</div>

        {/* Step counter */}
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {t("stepIndicator", { current: step + 1, total: TOTAL })}
        </p>

        {/* Title */}
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(`${currentKey}.title`)}
        </h1>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t(`${currentKey}.description`)}
        </p>

        {/* Optional inline CTA (install step only) */}
        {currentKey === "install" && (
          <div>
            <a
              href="https://chromewebstore.google.com/detail/trail/pginmdonnghdkcmnhjkniphopcfapodc"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
            >
              {t("install.ctaLabel")}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

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
                {t("goToDashboard")}
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                {t("next")}
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
              {t("skip")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
