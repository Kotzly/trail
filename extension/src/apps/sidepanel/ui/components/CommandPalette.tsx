import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@ui/components/ui/command";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import { browser } from "@shared/platform/webext.js";
import { navigateToNodeId } from "../../api/tree.js";
import type { NodeId, Url } from "@shared/types/ids.js";

type NodeEntry = {
  id: NodeId;
  title: string;
  url: string;
  favicon?: string;
};

/**
 * Hard cap on nodes passed to cmdk. cmdk filters client-side and renders
 * all matches, so for huge trees we'd overwhelm the DOM. 2000 covers the
 * vast majority of real trees and the first match for any query is always
 * within this window thanks to the depth-first tree.iter() order.
 */
const NODE_CAP = 2000;

export default function CommandPalette() {
  const open = useStore((s) => s.commandPalette.open);
  const setOpen = useStore((s) => s.setCommandPaletteOpen);
  const tree = useStore((s) => s.tree);
  const [query, setQuery] = useState("");

  // Defer mounting the (potentially huge) Nodes group. useEffect runs
  // after commit + paint, so the open dialog appears first; the transition
  // then schedules the heavy mount as non-urgent and yields to the input.
  // `isPending` powers the inline "loading" hint during that window.
  const [nodesReady, setNodesReady] = useState(false);
  const [isPending, startTransition] = useTransition();
  useEffect(() => {
    if (!open) {
      setNodesReady(false);
      return;
    }
    startTransition(() => setNodesReady(true));
  }, [open]);

  // Close handler resets query directly — no useEffect-as-state-reset.
  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery("");
    setOpen(next);
  };

  // Build the entry list lazily — only when the palette is actually open.
  // Avoids paying the iteration cost on every tree mutation in the
  // background while the palette sits closed.
  const nodes: NodeEntry[] = useMemo(() => {
    if (!tree || !open) return [];
    const result: NodeEntry[] = [];
    for (const node of tree.iter()) {
      result.push({
        id: node.id,
        title: String(node.data.title ?? node.data.url ?? "Untitled"),
        url: String(node.data.url ?? ""),
        favicon: node.data.favicon ? String(node.data.favicon) : undefined,
      });
      if (result.length >= NODE_CAP) break;
    }
    return result;
  }, [tree, open]);

  const handleNavigate = (entry: NodeEntry) => {
    handleOpenChange(false);
    void navigateToNodeId(entry.id, entry.url as Url);
  };

  const handleOpenInNewTab = (entry: NodeEntry) => {
    handleOpenChange(false);
    browser.tabs.create({ url: entry.url, active: true }).catch((error) => {
      console.error("Failed to open in new tab:", error);
    });
  };

  const openSettings = () => {
    handleOpenChange(false);
    const url = chrome.runtime.getURL("settings.html");
    browser.tabs.create({ url, active: true }).catch((error) => {
      console.error("Failed to open settings:", error);
    });
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search Trail"
      description="Search nodes, jump between trees, or run commands"
      // Keyboard-triggered surface (100+/day). Per Emil's frequency rule
      // we kill the open/close zoom-and-fade entirely — Raycast pattern.
      className="data-closed:duration-0 data-open:duration-0"
    >
      <CommandInput
        placeholder="Search nodes or type a command..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        {isPending && !nodesReady && (
          <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs">
            <Icons.Loader2 className="size-3 animate-spin" />
            Loading nodes…
          </div>
        )}
        {nodesReady && nodes.length > 0 && (
          <CommandGroup
            heading="Nodes"
            // Subtle async-settle: ~150ms strong ease-out, opacity + 4px
            // slide from top. Never scale(0) — we start visible. Gated on
            // motion-safe so reduced-motion users get an instant mount.
            className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)]"
          >
            {nodes.map((entry) => (
              <CommandItem
                key={entry.id}
                value={`${entry.title} ${entry.url}`}
                onSelect={() => handleNavigate(entry)}
                className="gap-2"
              >
                {entry.favicon ? (
                  <img
                    src={entry.favicon}
                    alt=""
                    width={14}
                    height={14}
                    className="size-3.5 shrink-0 rounded-sm"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                ) : (
                  <Icons.Search className="text-muted-foreground size-3.5 shrink-0" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px]">{entry.title}</span>
                  <span className="text-muted-foreground truncate text-[11px]">{entry.url}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="open settings" onSelect={openSettings}>
            <Icons.Settings className="size-3.5" />
            Open settings
          </CommandItem>
          {nodes[0] && (
            <CommandItem
              value="open first result in new tab"
              onSelect={() => {
                const first = nodes[0];
                if (first) handleOpenInNewTab(first);
              }}
            >
              <Icons.ExternalLink className="size-3.5" />
              Open first result in new tab
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
