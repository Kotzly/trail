/**
 * Screen 1 — Hook. A single crisp value promise, designed to "stop
 * scrolling" and validate the user's decision to install Trail. One
 * big sentence, warm tone, no capslock.
 */

import { i18n } from "#i18n";
import TrailLogo from "@ui/components/trail-logo";

export function HookScreen() {
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex h-full flex-col items-center gap-5 text-center duration-300 ease-(--ease-out)">
      <div className="animate-in fade-in-0 zoom-in-95 relative -mx-5 -mt-2 w-[calc(100%+2.5rem)] duration-500 ease-(--ease-out)">
        <img
          src="/onboarding/hook-hero.jpg"
          alt=""
          aria-hidden
          className="aspect-[5/2] w-full object-cover"
        />
        <div className="bg-card absolute -bottom-6 left-8 flex size-12 items-center justify-center rounded-full shadow-md">
          <TrailLogo
            animated
            variant="field"
            className="!h-9 !w-9 [--trail-logo-bg:transparent]"
            label="Trail"
          />
        </div>
      </div>
      <div className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both flex w-full flex-col gap-2 self-stretch pt-4 duration-500 ease-(--ease-out)">
        <h2 className="text-foreground text-2xl leading-tight font-semibold tracking-tight">
          {i18n.t("onboarding.v2.hook.title")}
        </h2>
        <p className="text-muted-foreground mx-auto max-w-[300px] text-[13px] leading-relaxed">
          {i18n.t("onboarding.v2.hook.body")}
        </p>
      </div>
    </div>
  );
}
