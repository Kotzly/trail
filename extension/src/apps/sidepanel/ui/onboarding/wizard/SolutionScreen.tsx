/**
 * Screen 4 — Solution, tailored to the persona picked on screen 3.
 *
 * Layout:
 *   - Title + short promise (tailored to persona)
 *   - Abstract animated mini-tree visual
 *   - "Imagine:" block — one concrete micro-scenario (tailored)
 *   - Three short chips: features as outcomes (tailored)
 *
 * The chips and imagine block keep the screen from feeling empty
 * while still being scannable in ~3 seconds.
 */

import { i18n } from "#i18n";
import { cn } from "@ui/lib/utils";
import { Badge } from "@ui/components/ui/badge";
import type { OnboardingPersona } from "@shared/config/storage-items.js";
import { SolutionVisual } from "./SolutionVisual.js";

type Props = {
  persona: OnboardingPersona | null;
};

const CHIP_KEYS = ["c1", "c2", "c3"] as const;
type I18nArg = Parameters<typeof i18n.t>[0];

export function SolutionScreen({ persona }: Props) {
  const key = persona ?? "research";

  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-3.5 duration-300 ease-(--ease-out)">
      <div
        className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-col gap-1.5 duration-300 ease-(--ease-out)"
        style={{ animationDelay: "60ms" }}
      >
        <h2 className="text-foreground text-[17px] leading-snug font-semibold tracking-tight">
          {i18n.t(`onboarding.v2.solution.${key}.title` as I18nArg)}
        </h2>
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          {i18n.t(`onboarding.v2.solution.${key}.body` as I18nArg)}
        </p>
      </div>

      <div
        key={`visual-${key}`}
        className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-500 ease-(--ease-out)"
        style={{ animationDelay: "180ms" }}
      >
        <SolutionVisual persona={persona} />
      </div>

      <figure
        className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-col gap-1 px-1 duration-500 ease-(--ease-out)"
        style={{ animationDelay: "320ms" }}
      >
        <figcaption className="text-muted-foreground/70 font-mono text-[10px] font-medium tracking-[0.18em] uppercase">
          {i18n.t("onboarding.v2.solution.imagineLabel" as I18nArg)}
        </figcaption>
        <blockquote
          cite=""
          className={cn(
            "text-foreground/90 font-serif text-[15px] leading-snug font-normal italic",
            "max-w-[55ch]",
          )}
        >
          {i18n.t(`onboarding.v2.solution.${key}.imagine` as I18nArg)}
        </blockquote>
      </figure>

      <div className="flex flex-wrap gap-1.5">
        {CHIP_KEYS.map((c, i) => (
          <Badge
            key={c}
            variant="secondary"
            className={cn(
              "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both rounded-full px-2.5 py-1 text-[11px] duration-400 ease-(--ease-out)",
            )}
            style={{ animationDelay: `${460 + i * 80}ms` }}
          >
            {i18n.t(`onboarding.v2.solution.${key}.chips.${c}` as I18nArg)}
          </Badge>
        ))}
      </div>
    </div>
  );
}
