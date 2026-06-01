/**
 * One-time "what's new" surface for users upgrading into the 1.1 line
 * (sharing landed in 1.1.0). The SW's onInstalled handler stamps
 * `pendingWelcomeBackVersionItem` with the current version on a
 * qualifying upgrade; this dialog reads the flag on mount, opens, and
 * clears it on dismiss so it never returns.
 *
 * Fresh installs never see this — `reason: "install"` skips the flag.
 */

import { useEffect, useState } from "react";
import { i18n } from "#i18n";
import { pendingWelcomeBackVersionItem } from "@shared/config/storage-items.js";
import { Button } from "@ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/components/ui/dialog";
import { Icons } from "@ui/components/icons";

type I18nArg = Parameters<typeof i18n.t>[0];

export function WelcomeBackDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void pendingWelcomeBackVersionItem.getValue().then((value) => {
      if (!cancelled && value !== null) setOpen(true);
    });
    const unwatch = pendingWelcomeBackVersionItem.watch((value) => {
      if (value !== null) setOpen(true);
    });
    return () => {
      cancelled = true;
      unwatch();
    };
  }, []);

  const dismiss = async (): Promise<void> => {
    setOpen(false);
    await pendingWelcomeBackVersionItem.removeValue();
  };

  const handleOpenChange = (next: boolean): void => {
    if (!next) void dismiss();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Cap at 70% of the side panel width — the side panel is the dialog's
       * viewport, so 70vw maps directly to "70% of the panel". Overrides
       * shadcn's `max-w-[calc(100%-2rem)]` / `sm:max-w-md` defaults. */}
      <DialogContent className="max-w-[70vw] sm:max-w-[70vw]">
        {/* Decorative icon badge. Per-dialog only by icon choice; sizing,
         * tint, and entry animation match across all prompts so the variation
         * reads as semantic, not decorative slop. Pattern mirrors
         * onboarding/wizard/HookScreen.tsx (tw-animate-css, no custom CSS). */}
        <div
          aria-hidden
          className="bg-primary/10 text-primary animate-in fade-in-0 zoom-in-95 -mt-1 flex size-12 items-center justify-center justify-self-start rounded-full duration-300 ease-(--ease-out)"
        >
          <Icons.Sparkles className="size-6" aria-hidden />
        </div>
        <DialogHeader>
          <DialogTitle>{i18n.t("whatsNew.upgraded.title" as I18nArg)}</DialogTitle>
          <DialogDescription>{i18n.t("whatsNew.upgraded.body" as I18nArg)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => void dismiss()}>
            {i18n.t("whatsNew.upgraded.cta.dismiss" as I18nArg)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WelcomeBackDialog;
