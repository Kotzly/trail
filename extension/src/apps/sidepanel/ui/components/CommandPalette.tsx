import { useDeferredValue, useMemo, useState } from "react";
import { i18n } from "#i18n";
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
import { Separator } from "@ui/components/ui/separator";
import { ButtonTooltip } from "@ui/components/button-tooltip";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import { browser } from "@shared/platform/webext.js";
import { navigateToNodeId } from "../../api/tree.js";
import type { Url } from "@shared/types/ids.js";
import { type IndexEntry, SearchIndex } from "./command-palette-search.js";
import { useDeleteFlow } from "../hooks/useDeleteFlow.js";

/** Hard limit on items rendered in the Nodes group. cmdk filters are
 *  disabled (`shouldFilter={false}`) so what we render is exactly what
 *  the user sees — the cap keeps mount/unmount cost bounded per
 *  keystroke and on close. */
const VISIBLE_LIMIT = 50;

const SEARCH_KEYS = ["meta", "K"] as const;

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ButtonTooltip label={i18n.t("sidepanel.search.label")} keys={SEARCH_KEYS}>
        <DialogTrigger asChild>
          <Button
            id="searchBtn"
            variant="secondary"
            size="icon"
            type="button"
            aria-label={i18n.t("sidepanel.search.label")}
            className="press-feedback"
          >
            <Icons.Search />
          </Button>
        </DialogTrigger>
      </ButtonTooltip>
      <DialogContent
        showCloseButton={false}
        className="top-1/3 translate-y-0 overflow-hidden p-0 data-closed:duration-[80ms] data-closed:ease-(--ease-out) data-open:duration-(--dur-fast) data-open:ease-(--ease-out)"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{i18n.t("sidepanel.search.title")}</DialogTitle>
          <DialogDescription>{i18n.t("sidepanel.search.description")}</DialogDescription>
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
 * Index lifecycle: built once per treeIndex reference (the store hands
 * us a fresh `TreeIndex` on every applyTreeState — see store.ts), cached
 * by useMemo. Filtering and ranking happen inside the index; this
 * component just plumbs the deferred query through and renders results.
 */
function PaletteBody({ onClose }: { onClose: () => void }) {
  const treeIndex = useStore((s) => s.treeIndex);
  const currentNodeId = useStore((s) => s.currentNodeId);
  const selectedNodeIds = useStore((s) => s.graph.selectedNodeIds);
  const activeTreeId = useStore((s) => s.trees.active?.id ?? null);
  const { request: requestDelete } = useDeleteFlow();
  const [query, setQuery] = useState("");

  const index = useMemo(
    () => (treeIndex.size > 0 ? new SearchIndex(treeIndex) : null),
    [treeIndex],
  );

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

  const heading = query.trim()
    ? i18n.t("sidepanel.search.headingNodes")
    : i18n.t("sidepanel.search.headingRecent");
  const firstMatch = matches[0];

  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder={i18n.t("sidepanel.search.placeholder")}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{i18n.t("sidepanel.search.empty")}</CommandEmpty>
        {matches.length > 0 && (
          <CommandGroup heading={heading}>
            {matches.map((entry, index) => (
              <CommandItem
                key={entry.id}
                value={String(entry.id)}
                onSelect={() => handleNavigate(entry)}
                className="animate-in fade-in-0 slide-in-from-top-1 fill-mode-both gap-2 duration-(--dur-fast) ease-(--ease-out)"
                style={{ animationDelay: `${Math.min(index, 9) * 30}ms` }}
              >
                {entry.favicon ? (
                  <img
                    src={entry.favicon}
                    alt=""
                    width={14}
                    height={14}
                    className="size-3.5 shrink-0"
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
        <CommandGroup heading={i18n.t("sidepanel.search.headingActions")}>
          <CommandItem value="open-settings" onSelect={openSettings}>
            <Icons.Settings className="size-3.5" />
            {i18n.t("sidepanel.search.openSettings")}
          </CommandItem>
          {firstMatch && (
            <CommandItem
              value="open-first-in-new-tab"
              onSelect={() => handleOpenInNewTab(firstMatch)}
            >
              <Icons.ExternalLink className="size-3.5" />
              {i18n.t("sidepanel.search.openFirstInNewTab")}
            </CommandItem>
          )}
          {currentNodeId && (
            <CommandItem
              value="delete-current-node"
              onSelect={() => {
                onClose();
                void requestDelete(
                  { kind: "node", nodeIds: [currentNodeId], recursive: false },
                  { source: "palette" },
                );
              }}
            >
              <Icons.Trash2 className="size-3.5" />
              {i18n.t("sidepanel.paletteDelete.deleteCurrentNode")}
              <Kbd className="ml-auto">Del</Kbd>
            </CommandItem>
          )}
          {selectedNodeIds.size > 0 && (
            <CommandItem
              value="delete-selected"
              onSelect={() => {
                onClose();
                void requestDelete(
                  {
                    kind: "node",
                    nodeIds: Array.from(selectedNodeIds),
                    recursive: false,
                  },
                  { source: "palette" },
                );
              }}
            >
              <Icons.Trash2 className="size-3.5" />
              {i18n.t("sidepanel.paletteDelete.deleteSelected", [String(selectedNodeIds.size)])}
              <Kbd className="ml-auto">Del</Kbd>
            </CommandItem>
          )}
          {activeTreeId && (
            <CommandItem
              value="delete-current-tree"
              onSelect={() => {
                onClose();
                void requestDelete({ kind: "tree", treeId: activeTreeId }, { source: "palette" });
              }}
            >
              <Icons.Trash2 className="size-3.5" />
              {i18n.t("sidepanel.paletteDelete.deleteCurrentTree")}
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
      <Separator />
      <div className="text-muted-foreground flex items-center justify-end gap-3 px-3 py-1.5 text-[11px]">
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd> {i18n.t("sidepanel.search.kbdOpen")}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Esc</Kbd> {i18n.t("sidepanel.search.kbdClose")}
        </span>
      </div>
    </Command>
  );
}
