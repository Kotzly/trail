/**
 * Pin-to-toolbar popover — surfaces after onboarding completion to
 * remind the user how to pin Trail to the Chrome toolbar. Anchored
 * at the TOP of the side panel (not the bottom) because the toolbar
 * itself sits above the side panel: the popover physically points
 * toward the place the user has to click.
 *
 * Chrome offers no API to actually pin the action for the user, so
 * this stays purely instructional. The × / "Got it" both mark the
 * surface as dismissed.
 *
 * Mutex with the wizard / tour / celebration / CTA: only renders
 * after `completedAt != null`, which is set on celebration finish, so
 * none of those overlays are active when this is.
 *
 * Must mount inside a `<ReactFlow>` subtree (passed as `children` to
 * `<TrailGraph>`) since `<FlyingPopover>` uses xyflow's Panel.
 */

import { useCallback, useEffect, useRef } from "react";
import { i18n } from "#i18n";
import { Icons } from "@ui/components/icons";
import { Button } from "@ui/components/ui/button";
import { captureEvent } from "@shared/lib/observability.js";
import { dismissSoftCta } from "../../../api/onboarding.js";
import { useStore } from "../../state/store.js";
import { FlyingPopover } from "../flying/FlyingPopover.js";

export function PinFlyingPopover() {
  const phase = useStore((s) => s.onboarding.phase);
  const completedAt = useStore((s) => s.onboarding.completedAt);
  const softCtaDismissed = useStore((s) => s.onboarding.softCtaDismissed);

  const activeOverlay =
    phase === "wizard" || phase === "tour" || phase === "celebration" || phase === "cta";

  const visible = !activeOverlay && completedAt != null && softCtaDismissed?.pin !== true;

  const lastShownRef = useRef(false);
  useEffect(() => {
    if (visible && !lastShownRef.current) {
      lastShownRef.current = true;
      captureEvent("onboarding_soft_cta_shown", { surface: "pin" });
    } else if (!visible) {
      lastShownRef.current = false;
    }
  }, [visible]);

  const handleDismiss = useCallback(async () => {
    await dismissSoftCta("pin");
    const current = useStore.getState().onboarding.softCtaDismissed ?? {};
    useStore.getState().setOnboarding({
      softCtaDismissed: { ...current, pin: true },
    });
  }, []);

  const handleGotIt = useCallback(async () => {
    captureEvent("onboarding_soft_cta_clicked", { surface: "pin" });
    await handleDismiss();
  }, [handleDismiss]);

  if (!visible) return null;

  const header = (
    <>
      <Icons.Pin className="size-3" aria-hidden strokeWidth={1.75} />
      <span className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase">
        {i18n.t("onboarding.hintStrip.pin.title")}
      </span>
      <span className="ml-auto inline-flex items-center opacity-60" aria-hidden>
        <Icons.Move className="size-3" strokeWidth={1.75} />
      </span>
    </>
  );

  return (
    <FlyingPopover
      anchorNodeId={null}
      fallbackPosition="top-center"
      resetKey="pin"
      ariaLabel={i18n.t("onboarding.hintStrip.regionAriaLabel")}
      header={header}
    >
      <div className="flex flex-col gap-1 px-4 pt-3 pb-3">
        <h3 className="text-foreground font-serif text-[16px] leading-snug font-normal tracking-tight">
          {i18n.t("onboarding.hintStrip.pin.title")}
        </h3>
        <p className="text-muted-foreground max-w-[55ch] text-[13px] leading-relaxed">
          {i18n.t("onboarding.hintStrip.pin.body")}
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => void handleGotIt()}>
            {i18n.t("onboarding.hintStrip.pin.gotIt")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void handleDismiss()}
            className="text-muted-foreground hover:text-foreground ml-auto"
            aria-label={i18n.t("onboarding.hintStrip.dismissAriaLabel")}
          >
            <Icons.X className="size-3.5" />
          </Button>
        </div>
      </div>
    </FlyingPopover>
  );
}

export default PinFlyingPopover;
