/**
 * Screen 3 — Personalize. The user picks their main pain. The pick
 * drives both the next screen's copy and the final CTA tagline.
 * Single-select, immediate; picking auto-advances.
 */

import { i18n } from "#i18n";
import { cn } from "@ui/lib/utils";
import { Button } from "@ui/components/ui/button";
import { Icons } from "@ui/components/icons";
import type { OnboardingPersona } from "@shared/config/storage-items.js";

type PersonaOption = {
  id: OnboardingPersona;
  icon: React.ReactNode;
};

const OPTIONS: PersonaOption[] = [
  { id: "research", icon: <Icons.Search className="size-5" /> },
  { id: "article", icon: <Icons.BookOpen className="size-5" /> },
  { id: "learning", icon: <Icons.BrainCircuit className="size-5" /> },
  { id: "tabs", icon: <Icons.Layers className="size-5" /> },
];

type Props = {
  selected: OnboardingPersona | null;
  onSelect: (persona: OnboardingPersona) => void;
};

export function PersonaPickScreen({ selected, onSelect }: Props) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-4 duration-300 ease-(--ease-out)">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          {i18n.t("onboarding.v2.persona.title")}
        </h2>
        <p className="text-muted-foreground text-xs">{i18n.t("onboarding.v2.persona.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {OPTIONS.map((opt, i) => {
          const isSelected = selected === opt.id;
          return (
            <Button
              key={opt.id}
              type="button"
              variant="outline"
              onClick={() => onSelect(opt.id)}
              className={cn(
                "group h-auto items-start justify-start gap-3 px-3.5 py-3 text-left whitespace-normal transition-all duration-150",
                "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both ease-(--ease-out)",
                "hover:border-primary/50 hover:bg-accent/40",
                isSelected && "border-primary bg-primary/5 ring-primary/30 ring-2",
              )}
              style={{ animationDelay: `${80 + i * 80}ms` }}
              aria-pressed={isSelected}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center",
                  isSelected
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                )}
              >
                {opt.icon}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-foreground text-sm font-medium">
                  {i18n.t(`onboarding.v2.persona.options.${opt.id}.title`)}
                </span>
                <span className="text-muted-foreground text-[12px] leading-snug">
                  {i18n.t(`onboarding.v2.persona.options.${opt.id}.body`)}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
