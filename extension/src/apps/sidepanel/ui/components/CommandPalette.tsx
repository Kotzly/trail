import { useDeferredValue, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ui/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@ui/components/ui/command";
import { Button } from "@ui/components/ui/button";
import { Kbd } from "@ui/components/ui/kbd";
import { ButtonTooltip } from "@ui/components/button-tooltip";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import { browser } from "@shared/platform/webext.js";
import { navigateToNodeId } from "../../api/tree.js";
import type { Url } from "@shared/types/ids.js";
import { type IndexEntry, SearchIndex } from "./command-palette-search.js";

/** Hard limit on items rendered in the Nodes group. cmdk filters are
 *  disabled (`shouldFilter={false}`) so what we render is exactly what
 *  the user sees — the cap keeps mount/unmount cost bounded per
 *  keystroke and on close. */
const VISIBLE_LIMIT = 50;

/**
 * Command palette: search trigger + Radix dialog wired to the global
 * `commandPalette.open` state (so the keyboard shortcut and any other
 * caller can drive it). The trigger pattern lets Radix recognise the
 * search button as part of the dialog tree, so clicking it while open
 * closes cleanly without a re-open race.
 *
 * The body is rendered in a separate component so it mounts only when
 * the dialog opens — query state lives there and resets naturally on
 * unmount, no manual `setQuery("")` ceremony.
 */
export default function CommandPalette() {
  const open = useStore((s) => s.commandPalette.open);
  const setOpen = useStore((s) => s.setCommandPaletteOpen);
  const metaKey = useStore((s) => s.metaKey);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ButtonTooltip label="Search" keys={[metaKey?.short ?? "Ctrl", "K"]}>
        <DialogTrigger asChild>
          <Button
            id="searchBtn"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            type="button"
            aria-label="Search"
          >
            <Icons.Search />
          </Button>
        </DialogTrigger>
      </ButtonTooltip>
      <DialogContent
        showCloseButton={false}
        className="top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search Trail</DialogTitle>
          <DialogDescription>Search nodes, jump between trees, or run commands</DialogDescription>
        </DialogHeader>
        <PaletteBody onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Mounted only while the dialog is open. Owns the input/query state, so
 * it resets naturally when Radix unmounts the portal on close.
 *
 * Index lifecycle: built once per tree reference (the store hands us a
 * fresh `NavigationTree` on every applyTreeState — see store.ts), cached
 * by useMemo. Filtering and ranking happen inside the index; this
 * component just plumbs the deferred query through and renders results.
 */
function PaletteBody({ onClose }: { onClose: () => void }) {
  const tree = useStore((s) => s.tree);
  const [query, setQuery] = useState("");

  const index = useMemo(() => (tree ? new SearchIndex(tree) : null), [tree]);

  // useDeferredValue keeps the input snappy: React commits the new query
  // value first as urgent, then schedules the re-rank as low priority.
  const deferredQuery = useDeferredValue(query);
  const matches: readonly IndexEntry[] = useMemo(
    () => (index ? index.search(deferredQuery, VISIBLE_LIMIT) : []),
    [index, deferredQuery],
  );

  const handleNavigate = (entry: IndexEntry) => {
    onClose();
    void navigateToNodeId(entry.id, entry.url as Url);
  };

  const handleOpenInNewTab = (entry: IndexEntry) => {
    onClose();
    browser.tabs.create({ url: entry.url, active: true }).catch((error) => {
      console.error("Failed to open in new tab:", error);
    });
  };

  const openSettings = () => {
    onClose();
    const url = chrome.runtime.getURL("settings.html");
    browser.tabs.create({ url, active: true }).catch((error) => {
      console.error("Failed to open settings:", error);
    });
  };

  const heading = query.trim() ? "Nodes" : "Recent & frequent";
  const firstMatch = matches[0];

  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder="Search nodes or type a command..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        {matches.length > 0 && (
          <CommandGroup heading={heading}>
            {matches.map((entry) => (
              <CommandItem
                key={entry.id}
                value={String(entry.id)}
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
          <CommandItem value="open-settings" onSelect={openSettings}>
            <Icons.Settings className="size-3.5" />
            Open settings
          </CommandItem>
          {firstMatch && (
            <CommandItem
              value="open-first-in-new-tab"
              onSelect={() => handleOpenInNewTab(firstMatch)}
            >
              <Icons.ExternalLink className="size-3.5" />
              Open first result in new tab
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
      <div className="border-border/60 text-muted-foreground flex items-center justify-end gap-3 border-t px-3 py-1.5 text-[11px]">
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd> Open
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Esc</Kbd> Close
        </span>
      </div>
    </Command>
  );
}
