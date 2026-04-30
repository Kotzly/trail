/**
 * Bottom-anchored hint strip — surfaces a single post-completion
 * prompt:
 *
 *   `completedAt != null` + `!signin-dismissed` + `!signed-in` → "Sign in"
 *
 * Other ex-surfaces:
 *   - "Resume tour" moved to a draggable flying popover
 *     (`<ResumeTourPopover>`) anchored to the dismissed step's
 *     spotlight node.
 *   - "Pin to toolbar" was removed — the instruction read as nag, and
 *     Chrome offers no API to actually pin for the user, so it never
 *     paid for the screen real estate it took.
 *
 * Mutex with TourFlyingCoach / TourCelebration / TourCommitments by
 * construction: each of those only renders while `phase` matches its
 * own value, none of which overlap with the strip's trigger set.
 *
 * Auth-driven hide: while `authState.status === "signed-in"` the
 * sign-in surface is hidden without writing a dismiss flag, so it
 * returns on sign-out. Explicit × always marks dismissed.
 */

import { useCallback, useEffect, useRef } from "react";
import { i18n } from "#i18n";
import { Button } from "@ui/components/ui/button";
import { Card } from "@ui/components/ui/card";
import { Icons } from "@ui/components/icons";
import { captureEvent } from "@shared/lib/observability.js";
import { cn } from "@ui/lib/utils";
import { dismissSoftCta } from "../../../api/onboarding.js";
import { useStore } from "../../state/store.js";

export function OnboardingHintStrip() {
  const phase = useStore((s) => s.onboarding.phase);
  const completedAt = useStore((s) => s.onboarding.completedAt);
  const softCtaDismissed = useStore((s) => s.onboarding.softCtaDismissed);
  const authStatus = useStore((s) => s.authState.status);
  const signedIn = authStatus === "signed-in";
  const authResolved = authStatus !== "unknown";

  // Explicit mutex with other overlays — strip must not render while
  // the wizard / tour coach / celebration / CTA own the screen.
  const activeOverlay =
    phase === "wizard" || phase === "tour" || phase === "celebration" || phase === "cta";

  const visible =
    !activeOverlay &&
    completedAt != null &&
    softCtaDismissed?.signin !== true &&
    authResolved &&
    !signedIn;

  // Fire `shown` exactly once per visibility stretch.
  const lastShownRef = useRef(false);
  useEffect(() => {
    if (visible && !lastShownRef.current) {
      lastShownRef.current = true;
      captureEvent("onboarding_soft_cta_shown", { surface: "signin" });
    } else if (!visible) {
      lastShownRef.current = false;
    }
  }, [visible]);

  const handleDismiss = useCallback(async () => {
    await dismissSoftCta("signin");
    const current = useStore.getState().onboarding.softCtaDismissed ?? {};
    useStore.getState().setOnboarding({
      softCtaDismissed: { ...current, signin: true },
    });
  }, []);

  const handleSignIn = useCallback(async () => {
    captureEvent("onboarding_soft_cta_clicked", { surface: "signin" });
    try {
      const url = chrome.runtime.getURL("/login.html");
      void chrome.tabs.create({ url });
    } catch {
      // best-effort — if tabs.create fails, user can still dismiss.
    }
    // Don't mark dismissed — once auth lands, predicate hides the
    // strip. If auth never completes, strip reappears on next load.
  }, []);

  if (!visible) return null;

  return (
    <Card
      role="region"
      aria-label={i18n.t("onboarding.hintStrip.regionAriaLabel")}
      className={cn(
        "pointer-events-auto absolute inset-x-3 bottom-3 z-20 gap-0 py-0",
        "shadow-md",
        "animate-in slide-in-from-bottom-2 fade-in-0 duration-300",
      )}
    >
      <div className="flex items-start gap-3 px-4 pt-3 pb-3">
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground flex items-center gap-1.5">
            <span className="text-primary/80 inline-flex size-3 items-center [&>svg]:size-3">
              <Icons.Cloud className="size-4" aria-hidden />
            </span>
            <h3 className="text-foreground font-serif text-[15px] leading-snug font-normal tracking-tight">
              {i18n.t("onboarding.hintStrip.signin.title")}
            </h3>
          </div>
          <p className="text-muted-foreground mt-1 max-w-[55ch] text-[12px] leading-relaxed">
            {i18n.t("onboarding.hintStrip.signin.body")}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <Button type="button" size="sm" onClick={() => void handleSignIn()}>
              {i18n.t("onboarding.hintStrip.signin.cta")}
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => void handleDismiss()}
          aria-label={i18n.t("onboarding.hintStrip.dismissAriaLabel")}
          className="text-muted-foreground hover:text-foreground -mt-1 -mr-1"
        >
          <Icons.X className="size-3.5" />
        </Button>
      </div>
    </Card>
  );
}

export default OnboardingHintStrip;
