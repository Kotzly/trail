/**
 * One-time welcome-back surface for users upgrading from 0.9.x to 1.0.x.
 * The SW's onInstalled handler stamps `pendingWelcomeBackVersionItem`
 * with the current version on a qualifying upgrade; this dialog reads
 * the flag on mount, opens, and clears it on dismiss/CTA so it never
 * returns.
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

type I18nArg = Parameters<typeof i18n.t>[0];

function openLoginInNewTab(): void {
  try {
    const url = chrome.runtime.getURL("/login.html");
    void chrome.tabs.create({ url });
  } catch {
    // Best-effort. If tabs.create fails the dialog still closes below.
  }
}

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

  const handleSignIn = async (): Promise<void> => {
    openLoginInNewTab();
    await dismiss();
  };

  const handleOpenChange = (next: boolean): void => {
    if (!next) void dismiss();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{i18n.t("whatsNew.upgraded.title" as I18nArg)}</DialogTitle>
          <DialogDescription>{i18n.t("whatsNew.upgraded.body" as I18nArg)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => void dismiss()}>
            {i18n.t("whatsNew.upgraded.cta.dismiss" as I18nArg)}
          </Button>
          <Button onClick={() => void handleSignIn()}>
            {i18n.t("whatsNew.upgraded.cta.signin" as I18nArg)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WelcomeBackDialog;
