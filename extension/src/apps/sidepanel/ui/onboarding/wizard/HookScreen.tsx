/**
 * Screen 1 — Hook. A single crisp value promise, designed to "stop
 * scrolling" and validate the user's decision to install Trail.
 *
 * Editorial composition (not centered SaaS): logo anchors the right
 * edge; serif headline + monospace eyebrow read left-to-right like a
 * magazine spread.
 */

import { i18n } from "#i18n";
import TrailLogo from "@ui/components/trail-logo";

type I18nArg = Parameters<typeof i18n.t>[0];

export function HookScreen() {
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex w-full flex-col gap-5 duration-300 ease-(--ease-out)">
      <div className="animate-in fade-in-0 zoom-in-95 flex justify-end pr-2 duration-500 ease-(--ease-out)">
        <TrailLogo animated variant="field" className="trail-logo-hero" label="Trail" />
      </div>
      <div className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both flex w-full flex-col gap-1.5 duration-500 ease-(--ease-out)">
        <p className="text-muted-foreground/80 font-mono text-[10px] font-medium tracking-[0.18em] uppercase">
          {i18n.t("onboarding.v2.hook.eyebrow" as I18nArg)}
        </p>
        <h2 className="text-foreground font-serif text-[clamp(28px,5.2vw,40px)] leading-[1.05] font-normal tracking-tight">
          {i18n.t("onboarding.v2.hook.title")}
        </h2>
        <p className="text-muted-foreground max-w-[55ch] text-[13px] leading-relaxed">
          {i18n.t("onboarding.v2.hook.body")}
        </p>
      </div>
    </div>
  );
}
