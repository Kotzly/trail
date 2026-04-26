/**
 * Screen 1 — Hook. A single crisp value promise, designed to "stop
 * scrolling" and validate the user's decision to install Trail. One
 * big sentence, warm tone, no capslock.
 */

import { i18n } from "#i18n";
import TrailLogo from "@ui/components/trail-logo";
import { Card, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";

export function HookScreen() {
  return (
    <Card className="animate-in fade-in-0 slide-in-from-right-2 items-center gap-6 border-none bg-transparent py-0 text-center ring-0 duration-300 ease-(--ease-out)">
      <div className="animate-in fade-in-0 zoom-in-95 relative duration-500 ease-(--ease-out)">
        <TrailLogo animated variant="field" className="trail-logo-hero" label="Trail" />
      </div>
      <CardHeader className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both gap-2 px-0 duration-500 ease-(--ease-out)">
        <CardTitle className="text-2xl leading-tight font-semibold tracking-tight">
          {i18n.t("onboarding.v2.hook.title")}
        </CardTitle>
        <CardDescription className="mx-auto max-w-[320px] text-[13px] leading-relaxed">
          {i18n.t("onboarding.v2.hook.body")}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
