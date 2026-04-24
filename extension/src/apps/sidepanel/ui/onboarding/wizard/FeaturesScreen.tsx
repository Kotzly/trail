/**
 * Screen 5 — Features translated to outcomes. Three bullets, no
 * jargon. The primary CTA on this screen hands off to the
 * interactive tour.
 *
 * Closing the loop before we ask for their data: a collapsible
 * privacy disclosure sits under the bullets, reusing the pre-existing
 * `onboarding.privacy.*` copy. Closed by default so it doesn't
 * dilute the outcome promise — expandable for users who want the
 * specifics before clicking "Let me feel it".
 */

import { i18n } from "#i18n";
import { Icons } from "@ui/components/icons";

const BULLETS = ["b1", "b2", "b3"] as const;
const RECORDED = ["url", "title", "favicon"] as const;
const NEVER = ["keystrokes", "formContent", "passwords"] as const;

export function FeaturesScreen() {
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-4 duration-300">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          {i18n.t("onboarding.v2.features.title")}
        </h2>
      </div>

      <ul className="flex flex-col gap-2.5">
        {BULLETS.map((b, i) => (
          <li
            key={b}
            className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex items-start gap-2.5 duration-400"
            style={{ animationDelay: `${100 + i * 90}ms` }}
          >
            <span className="bg-primary/15 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
              <Icons.Check className="size-3" strokeWidth={3} aria-hidden />
            </span>
            <span className="text-foreground/90 text-[13px] leading-relaxed">
              {i18n.t(`onboarding.v2.features.bullets.${b}`)}
            </span>
          </li>
        ))}
      </ul>

      <details className="group border-border/60 text-muted-foreground bg-muted/30 mt-1 rounded-md border text-[12px] leading-relaxed">
        <summary className="hover:text-foreground focus-visible:ring-ring flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-3 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none">
          <span className="inline-flex items-center gap-1.5">
            <Icons.Shield className="size-3.5" aria-hidden />
            <span>{i18n.t("onboarding.privacy.title")}</span>
          </span>
          <Icons.ChevronDown
            className="size-3.5 transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="border-border/60 border-t px-3 pt-2.5 pb-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <div>
              <div className="text-foreground/80 mb-1 text-[11px] font-semibold tracking-wide uppercase">
                {i18n.t("onboarding.privacy.recordedHeader")}
              </div>
              <ul className="flex flex-col gap-0.5">
                {RECORDED.map((k) => (
                  <li key={k} className="inline-flex items-center gap-1.5">
                    <Icons.Check className="text-primary/80 size-3" strokeWidth={3} aria-hidden />
                    <span>{i18n.t(`onboarding.privacy.recordedItems.${k}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-foreground/80 mb-1 text-[11px] font-semibold tracking-wide uppercase">
                {i18n.t("onboarding.privacy.neverHeader")}
              </div>
              <ul className="flex flex-col gap-0.5">
                {NEVER.map((k) => (
                  <li key={k} className="inline-flex items-center gap-1.5">
                    <Icons.X className="text-muted-foreground/70 size-3" aria-hidden />
                    <span>{i18n.t(`onboarding.privacy.neverItems.${k}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-muted-foreground/80 mt-2.5 text-[11px]">
            {i18n.t("onboarding.privacy.footer")}
          </p>
        </div>
      </details>
    </div>
  );
}
