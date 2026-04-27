/**
 * Screen 1 — Hook. A single crisp value promise, designed to "stop
 * scrolling" and validate the user's decision to install Trail. One
 * big sentence, warm tone, no capslock.
 */

import { i18n } from "#i18n";
import TrailLogo from "@ui/components/trail-logo";

export function HookScreen() {
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex w-full flex-col items-center gap-6 text-center duration-300 ease-(--ease-out)">
      <div className="animate-in fade-in-0 zoom-in-95 relative duration-500 ease-(--ease-out)">
        <TrailLogo animated variant="field" className="trail-logo-hero" label="Trail" />
      </div>
      <div className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both flex w-full flex-col items-center gap-2 duration-500 ease-(--ease-out)">
        <h2 className="text-foreground text-2xl leading-tight font-semibold tracking-tight">
          {i18n.t("onboarding.v2.hook.title")}
        </h2>
        <p className="text-muted-foreground max-w-[320px] text-[13px] leading-relaxed">
          {i18n.t("onboarding.v2.hook.body")}
        </p>
      </div>
    </div>
  );
}
