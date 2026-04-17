import { useCallback, useEffect, useState } from "react";
import { browser } from "@shared/platform/webext.js";
import { cn } from "@ui/lib/utils";
import { Icons } from "@ui/components/icons";

type SidePanelApi = {
  setOptions?: (options: {
    tabId?: number;
    enabled?: boolean;
    path?: string;
  }) => Promise<void> | void;
  open?: (options: { tabId?: number; windowId?: number }) => Promise<void> | void;
};

function getSidePanel(): SidePanelApi | undefined {
  return (browser as typeof browser & { sidePanel?: SidePanelApi }).sidePanel;
}

/**
 * Edge-peeking widget on the right side of Settings — reveals on
 * hover, click opens the sidepanel for the current tab.
 *
 * Why a peek affordance instead of a giant button: Settings closes
 * the sidepanel by design (focused flow), but users should still have
 * a one-click escape hatch to bring the graph back without hunting
 * for the toolbar icon. Collapsed-by-default respects the focused
 * flow; hover-out reveal signals discoverability without nagging.
 *
 * Chrome's `sidePanel.open` is gated by a user-gesture rule — a React
 * click handler inside an extension page counts as one, so we call it
 * directly rather than round-tripping through the background.
 */
export function SidepanelPeek() {
  const [available, setAvailable] = useState(false);
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sp = getSidePanel();
    setAvailable(Boolean(sp?.open));
  }, []);

  const handleOpen = useCallback(async () => {
    const sp = getSidePanel();
    if (!sp?.open) return;
    setBusy(true);
    try {
      // Resolve our own tab id so we can flip `enabled: true` first
      // — the background's settings-tab coordinator disables the
      // panel for this tab when settings opens, and `open()` fails
      // silently against a disabled tab.
      let tab: { id?: number; windowId?: number } | undefined;
      try {
        tab = await browser.tabs.getCurrent();
      } catch {
        tab = undefined;
      }
      if (tab?.id !== undefined) {
        await sp.setOptions?.({ tabId: tab.id, enabled: true, path: "sidepanel.html" });
      }
      await sp.open({
        ...(tab?.id !== undefined ? { tabId: tab.id } : {}),
        ...(tab?.windowId !== undefined ? { windowId: tab.windowId } : {}),
      });
    } finally {
      setBusy(false);
    }
  }, []);

  if (!available) return null;

  return (
    <button
      type="button"
      aria-label="Open sidepanel"
      title="Open sidepanel"
      onClick={() => void handleOpen()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      disabled={busy}
      className={cn(
        "bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring",
        "fixed top-1/2 right-0 z-40 flex -translate-y-1/2 items-center gap-2",
        "rounded-l-full border border-r-0 py-2 pr-3 pl-2 shadow-sm",
        "transition-[transform,background-color,color] duration-200 ease-out",
        "focus-visible:ring-2 focus-visible:outline-none",
        "disabled:opacity-60",
        hover ? "translate-x-0" : "translate-x-[calc(100%-18px)]",
      )}
    >
      <Icons.ChevronLeft className="size-4 shrink-0" aria-hidden />
      <span
        className={cn(
          "text-foreground overflow-hidden text-xs whitespace-nowrap",
          "transition-[max-width,opacity] duration-200 ease-out",
          hover ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0",
        )}
      >
        Open sidepanel
      </span>
    </button>
  );
}
