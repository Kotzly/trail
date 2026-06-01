/**
 * Confirmation prompt for importing a shared trail.
 *
 * When a visitor clicks "Import to my Trail" on `/s/<code>`, the bridge
 * queues the code in `pendingShareImportItem` and opens the sidepanel — it
 * never imports silently. This dialog reads the pending code, shows what's
 * about to be imported, and runs the import only on explicit confirmation.
 * Identity-aware outcomes (self-import, sign-in) surface here, where we
 * actually know who the user is. Mirrors the WelcomeBackDialog pattern:
 * local `open` state, storage watch, cleared on confirm/dismiss.
 */

import { useEffect, useState } from "react";
import { i18n } from "#i18n";
import { pendingShareImportItem, type PendingShareImport } from "@shared/config/storage-items.js";
import type { ImportShareResult } from "@features/sharing/share-api.js";
import { Button } from "@ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/components/ui/dialog";
import { useAuthState } from "@shared/auth/use-auth-state.js";
import { confirmShareImport } from "../../api/sharing.js";
import { showUiToast } from "../notifications/sonner-adapter.js";
import { captureEvent } from "@shared/lib/observability.js";
import { Icons } from "@ui/components/icons";

// Drop codes queued more than an hour ago so a long-forgotten click doesn't
// pop a prompt during an unrelated later session.
const STALE_MS = 60 * 60 * 1000;

function openLoginInNewTab(): void {
  try {
    const url = chrome.runtime.getURL("/login.html");
    void chrome.tabs.create({ url });
  } catch {
    // Best-effort; the prompt stays open so the user can retry.
  }
}

export function ShareImportPrompt() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PendingShareImport | null>(null);
  const [phase, setPhase] = useState<"confirm" | "importing" | "error">("confirm");
  const [errorMessage, setErrorMessage] = useState("");
  // Pull auth from the in-process orchestrator, NOT the sidepanel store's
  // `authState`. That store field is push-only — hydrated by a one-shot
  // AUTH_STATE broadcast the panel usually misses on a warm service worker,
  // so it stays stuck at "unknown" for a signed-in user and this prompt would
  // wrongly show "Sign in". useAuthState() runs initAuth() itself, the same
  // source every other sharing surface (TreeDropdown, ShareDialog) uses.
  const signedIn = useAuthState().status === "signed-in";

  useEffect(() => {
    let cancelled = false;
    const show = (value: PendingShareImport | null): void => {
      if (cancelled || !value) return;
      if (Date.now() - value.queuedAt > STALE_MS) {
        void pendingShareImportItem.setValue(null);
        return;
      }
      setPending(value);
      setPhase("confirm");
      setErrorMessage("");
      setOpen(true);
    };
    void pendingShareImportItem.getValue().then(show);
    const unwatch = pendingShareImportItem.watch(show);
    return () => {
      cancelled = true;
      unwatch();
    };
  }, []);

  const dismiss = async (): Promise<void> => {
    setOpen(false);
    await pendingShareImportItem.setValue(null);
  };

  const handlePrimary = async (): Promise<void> => {
    if (!pending) return;
    if (!signedIn) {
      openLoginInNewTab();
      return;
    }
    setPhase("importing");
    const result = await confirmShareImport(pending.code);
    if (result.ok) {
      captureEvent("share_import_success");
      showUiToast({
        message: i18n.t("sidepanel.shareImport.successToast", [result.label]),
        icon: "Check",
      });
      setOpen(false);
      await pendingShareImportItem.setValue(null);
      return;
    }
    // Failed — surface the reason inline and stop re-prompting for this code.
    captureEvent("share_import_failed");
    setErrorMessage(messageForError(result));
    setPhase("error");
    await pendingShareImportItem.setValue(null);
  };

  const handleOpenChange = (next: boolean): void => {
    if (!next) void dismiss();
  };

  const importing = phase === "importing";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Cap at 70% of the side panel width — see WelcomeBackDialog for rationale. */}
      <DialogContent className="max-w-[70vw] sm:max-w-[70vw]">
        {/* Decorative icon badge — see WelcomeBackDialog for the pattern. */}
        <div
          aria-hidden
          className="bg-primary/10 text-primary animate-in fade-in-0 zoom-in-95 -mt-1 flex size-12 items-center justify-center justify-self-start rounded-full duration-300 ease-(--ease-out)"
        >
          <Icons.Share2 className="size-6" aria-hidden />
        </div>
        <DialogHeader>
          <DialogTitle>{i18n.t("sidepanel.shareImport.title")}</DialogTitle>
          <DialogDescription>
            {phase === "error" ? errorMessage : describePending(pending)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {phase === "error" ? (
            <Button onClick={() => void dismiss()}>{i18n.t("sidepanel.shareImport.close")}</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => void dismiss()} disabled={importing}>
                {i18n.t("sidepanel.shareImport.dismiss")}
              </Button>
              <Button onClick={() => void handlePrimary()} disabled={importing}>
                {importing
                  ? i18n.t("sidepanel.shareImport.importing")
                  : signedIn
                    ? i18n.t("sidepanel.shareImport.confirm")
                    : i18n.t("sidepanel.shareImport.signIn")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function describePending(pending: PendingShareImport | null): string {
  const label = pending?.label?.trim();
  if (!label) return i18n.t("sidepanel.shareImport.description");
  if (typeof pending?.nodeCount === "number") {
    return i18n.t("sidepanel.shareImport.descriptionNamedCount", [
      label,
      String(pending.nodeCount),
    ]);
  }
  return i18n.t("sidepanel.shareImport.descriptionNamed", [label]);
}

function messageForError(result: Extract<ImportShareResult, { ok: false }>): string {
  switch (result.error) {
    case "share-self-import":
      return i18n.t("sidepanel.shareImport.errorSelfImport");
    case "share-unavailable":
      return i18n.t("sidepanel.shareImport.errorUnavailable");
    case "share-no-device":
      return i18n.t("sidepanel.shareImport.errorNoDevice");
    default:
      return result.message || i18n.t("sidepanel.shareImport.errorGeneric");
  }
}

export default ShareImportPrompt;
