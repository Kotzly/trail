/**
 * Bottom-anchored hint strip that surfaces ONE of three post-onboarding
 * prompts at a time, in priority order:
 *
 *   1. `phase === "tourDismissed"` → "Resume tour"
 *   2. `completedAt != null` + `!signin-dismissed` + `!signed-in` → "Sign in"
 *   3. `completedAt != null` + `!pin-dismissed` → "Pin to toolbar"
 *
 * Mutex with TourCoach / TourCelebration / TourCommitments by
 * construction: each of those only renders while `phase` matches its
 * own value, none of which overlap with the strip's trigger set.
 *
 * Auth-driven hide: while `authState.status === "signed-in"` the
 * sign-in surface is hidden without writing a dismiss flag, so it
 * returns on sign-out. Explicit × always marks dismissed.
 *
 * Chrome extensions cannot detect or trigger toolbar pinning, so the
 * Pin surface shows instructions and relies on the × / "Got it" to
 * dismiss.
 */

import { useCallback, useEffect, useRef } from "react";
import { i18n } from "#i18n";
import type { OnboardingSoftCtaKey } from "@shared/config/storage-items.js";
import { Avatar, AvatarFallback } from "@ui/components/ui/avatar";
import { Button } from "@ui/components/ui/button";
import { Card } from "@ui/components/ui/card";
import { Icons } from "@ui/components/icons";
import { captureEvent } from "@shared/lib/observability.js";
import { cn } from "@ui/lib/utils";
import {
  dismissSoftCta,
  disposeTourTree,
  getOnboardingState,
  resumeTour,
  skipOnboarding,
} from "../../../api/onboarding.js";
import { useStore } from "../../state/store.js";

type Surface = "resume" | "signin" | "pin";

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

  // Pick the active surface. Strict priority prevents stacking.
  let surface: Surface | null = null;
  if (activeOverlay) {
    surface = null;
  } else if (phase === "tourDismissed" && completedAt == null) {
    surface = "resume";
  } else if (completedAt != null) {
    if (softCtaDismissed?.signin !== true && authResolved && !signedIn) {
      surface = "signin";
    } else if (softCtaDismissed?.pin !== true) {
      surface = "pin";
    }
  }

  // Fire `shown` exactly once per surface-visibility stretch.
  const lastShownRef = useRef<Surface | null>(null);
  useEffect(() => {
    if (surface && lastShownRef.current !== surface) {
      lastShownRef.current = surface;
      captureEvent("onboarding_soft_cta_shown", { surface });
    } else if (!surface) {
      lastShownRef.current = null;
    }
  }, [surface]);

  const handleDismissSoftCta = useCallback(async (key: OnboardingSoftCtaKey) => {
    await dismissSoftCta(key);
    const current = useStore.getState().onboarding.softCtaDismissed ?? {};
    useStore.getState().setOnboarding({
      softCtaDismissed: { ...current, [key]: true },
    });
  }, []);

  const handleResume = useCallback(async () => {
    captureEvent("onboarding_soft_cta_clicked", { surface: "resume" });
    // Verify the tour tree still exists before flipping phase. If the
    // user removed it from the tree list after dismiss, recover
    // gracefully instead of opening a nonexistent tree. `resumeTour`
    // itself has a belt-and-braces orphan fallback if openTree
    // throws (e.g., stale store snapshot).
    const stored = await getOnboardingState();
    const tourTreeId = stored.tourTreeId;
    const trees = useStore.getState().trees;
    const treeExists = Boolean(
      tourTreeId &&
      (trees.active?.id === tourTreeId || trees.others.some((t) => t.id === tourTreeId)),
    );
    const result = await resumeTour({ treeExists });
    if (result === "ok") {
      useStore.getState().setOnboarding({ phase: "tour" });
    } else {
      useStore.getState().setOnboarding({
        phase: "done",
        tourTreeId: null,
        tourStep: 0,
      });
    }
  }, []);

  const handleDismissResume = useCallback(async () => {
    // Dismissing the Resume chip is effectively "I don't want to
    // finish the tour." Clean up the tour tree and mark onboarding
    // done so the strip doesn't keep nagging. No `completedAt` —
    // they didn't actually complete.
    captureEvent("onboarding_soft_cta_dismissed", { surface: "resume" });
    await disposeTourTree();
    await skipOnboarding();
    useStore.getState().setOnboarding({
      phase: "done",
      tourTreeId: null,
      tourStep: 0,
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

  const handlePinGotIt = useCallback(async () => {
    captureEvent("onboarding_soft_cta_clicked", { surface: "pin" });
    await handleDismissSoftCta("pin");
  }, [handleDismissSoftCta]);

  if (!surface) return null;

  if (surface === "resume") {
    return (
      <StripShell ariaLabel={i18n.t("onboarding.hintStrip.regionAriaLabel")}>
        <StripBody
          icon={<Icons.Compass className="size-4" aria-hidden />}
          title={i18n.t("onboarding.hintStrip.resume.title")}
          body={i18n.t("onboarding.hintStrip.resume.body")}
          primary={{
            label: i18n.t("onboarding.hintStrip.resume.cta"),
            onClick: () => void handleResume(),
          }}
          onDismiss={() => void handleDismissResume()}
        />
      </StripShell>
    );
  }

  if (surface === "signin") {
    return (
      <StripShell ariaLabel={i18n.t("onboarding.hintStrip.regionAriaLabel")}>
        <StripBody
          icon={<Icons.Cloud className="size-4" aria-hidden />}
          title={i18n.t("onboarding.hintStrip.signin.title")}
          body={i18n.t("onboarding.hintStrip.signin.body")}
          primary={{
            label: i18n.t("onboarding.hintStrip.signin.cta"),
            onClick: () => void handleSignIn(),
          }}
          onDismiss={() => void handleDismissSoftCta("signin")}
        />
      </StripShell>
    );
  }

  // pin — Chrome has no API to pin programmatically, so we just show
  // instructions and dismiss on "Got it" or ×.
  return (
    <StripShell ariaLabel={i18n.t("onboarding.hintStrip.regionAriaLabel")}>
      <StripBody
        icon={<Icons.Pin className="size-4" aria-hidden />}
        title={i18n.t("onboarding.hintStrip.pin.title")}
        body={i18n.t("onboarding.hintStrip.pin.body")}
        primary={{
          label: i18n.t("onboarding.hintStrip.pin.gotIt"),
          onClick: () => void handlePinGotIt(),
        }}
        onDismiss={() => void handleDismissSoftCta("pin")}
      />
    </StripShell>
  );
}

function StripShell({ children, ariaLabel }: { children: React.ReactNode; ariaLabel: string }) {
  return (
    <Card
      role="region"
      aria-label={ariaLabel}
      className={cn(
        "pointer-events-auto absolute inset-x-3 bottom-3 z-20 gap-0 py-0 backdrop-blur",
        "shadow-md",
        "animate-in slide-in-from-bottom-2 fade-in-0 duration-300",
      )}
    >
      {children}
    </Card>
  );
}

function StripBody({
  icon,
  title,
  body,
  primary,
  onDismiss,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  primary: { label: string; onClick: () => void };
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start gap-3 px-4 pt-3 pb-3">
      <Avatar size="sm" className="mt-0.5 size-7">
        <AvatarFallback className="bg-primary/15 text-primary">{icon}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <h3 className="text-foreground text-[13px] font-semibold tracking-tight">{title}</h3>
        <p className="text-muted-foreground mt-0.5 text-[12px] leading-relaxed">{body}</p>
        <div className="mt-2.5 flex items-center gap-2">
          <Button type="button" size="sm" onClick={primary.onClick}>
            {primary.label}
          </Button>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onDismiss}
        aria-label={i18n.t("onboarding.hintStrip.dismissAriaLabel")}
        className="text-muted-foreground hover:text-foreground -mt-1 -mr-1"
      >
        <Icons.X className="size-3.5" />
      </Button>
    </div>
  );
}

export default OnboardingHintStrip;
