/**
 * Screen 7 — Quick Win. Celebrates the tour with node count + time.
 * Shown as a full-sidepanel overlay for a couple of seconds before
 * auto-advancing to the CTA screen. The user can dismiss early.
 *
 * The emotional beat: "look what you did." Short. Loud enough to be
 * a payoff; not loud enough to be corny.
 */

import "./confetti.css";
import { useEffect, useMemo, useState } from "react";
import { i18n } from "#i18n";
import { Button } from "@ui/components/ui/button";
import { Icons } from "@ui/components/icons";
import { cn } from "@ui/lib/utils";
import { setOnboardingPhase } from "../../../api/onboarding.js";
import { useStore } from "../../state/store.js";

type I18nArg = Parameters<typeof i18n.t>[0];

const AUTO_ADVANCE_MS = 3200;
const CONFETTI_COUNT = 28;
const CONFETTI_COLORS = [
  "var(--primary)",
  "color-mix(in oklab, var(--primary) 60%, white)",
  "color-mix(in oklab, var(--primary) 40%, black)",
  "var(--foreground)",
];

function Confetti() {
  // Seeded-ish deterministic positions so re-renders don't reshuffle.
  const dots = useMemo(() => {
    const out: React.CSSProperties[] = [];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const x = (i * 37) % 100;
      const tx = ((i * 13) % 80) - 40;
      const rot = ((i * 97) % 720) - 360;
      const delay = (i % 6) * 80;
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]!;
      out.push({
        left: `${x}%`,
        backgroundColor: color,
        animationDelay: `${delay}ms`,
        ["--confetti-tx" as string]: `${tx}px`,
        ["--confetti-rot" as string]: `${rot}deg`,
      });
    }
    return out;
  }, []);

  return (
    <div className="confetti-layer" aria-hidden>
      {dots.map((style, i) => (
        <span
          key={i}
          className={cn("confetti-dot", i % 3 === 0 && "square", i % 3 === 1 && "round")}
          style={style}
        />
      ))}
    </div>
  );
}

/**
 * Inner component, mounted only while `phase === "celebration"`. Its
 * useState lazy initializer captures "seconds elapsed" exactly once
 * at that mount — no Date.now() call during any render.
 */
function CelebrationBody({ startedAt }: { startedAt: number | null }) {
  const nodeCount = useStore((s) => s.nodeCount);
  const persona = useStore((s) => s.onboarding.persona);

  const [secondsLabel] = useState<string>(() => {
    if (!startedAt) return "—";
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    return String(seconds);
  });

  const bodyKey = (
    persona ? `onboarding.celebration.bodyByPersona.${persona}` : "onboarding.celebration.body"
  ) as I18nArg;

  useEffect(() => {
    const id = window.setTimeout(() => {
      void setOnboardingPhase("cta");
      useStore.getState().setOnboarding({ phase: "cta" });
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, []);

  const handleContinue = () => {
    void setOnboardingPhase("cta");
    useStore.getState().setOnboarding({ phase: "cta" });
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={i18n.t("onboarding.celebration.title" as I18nArg)}
      className="animate-in fade-in-0 bg-background/95 absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden px-6 text-center backdrop-blur-sm duration-500"
    >
      <Confetti />
      <div className="animate-in zoom-in-95 slide-in-from-bottom-2 relative z-10 flex flex-col items-center gap-4 duration-700">
        <div className="bg-primary/15 text-primary flex size-14 items-center justify-center rounded-full">
          <Icons.Sparkles className="size-7" aria-hidden />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-foreground text-2xl font-semibold tracking-tight">
            {i18n.t("onboarding.celebration.title", [String(nodeCount), secondsLabel])}
          </h2>
          <p className="text-muted-foreground max-w-[260px] text-sm leading-relaxed">
            {i18n.t(bodyKey)}
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={handleContinue}>
          {i18n.t("onboarding.celebration.cta" as I18nArg)}
        </Button>
      </div>
    </div>
  );
}

export function TourCelebration() {
  const phase = useStore((s) => s.onboarding.phase);
  const startedAt = useStore((s) => s.onboarding.startedAt);

  if (phase !== "celebration") return null;
  return <CelebrationBody startedAt={startedAt} />;
}

export default TourCelebration;
