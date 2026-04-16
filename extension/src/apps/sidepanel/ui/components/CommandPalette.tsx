import { useEffect, useMemo, useState } from "react";
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

const MAX_RESULTS = 40;

export default function CommandPalette() {
  const open = useStore((s) => s.commandPalette.open);
  const setOpen = useStore((s) => s.setCommandPaletteOpen);
  const tree = useStore((s) => s.tree);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const nodes: NodeEntry[] = useMemo(() => {
    if (!tree) return [];
    const result: NodeEntry[] = [];
    for (const node of tree.iter()) {
      result.push({
        id: node.id,
        title: String(node.data.title ?? node.data.url ?? "Untitled"),
        url: String(node.data.url ?? ""),
        favicon: node.data.favicon ? String(node.data.favicon) : undefined,
      });
      if (result.length >= 2000) break; // guard for massive trees; filter happens in cmdk
    }
    return result;
  }, [tree]);

  const handleNavigate = (entry: NodeEntry) => {
    setOpen(false);
    void navigateToNodeId(entry.id, entry.url as Url);
  };

  const handleOpenInNewTab = (entry: NodeEntry) => {
    setOpen(false);
    browser.tabs.create({ url: entry.url, active: true }).catch((error) => {
      console.error("Failed to open in new tab:", error);
    });
  };

  const openSettings = () => {
    setOpen(false);
    const url = chrome.runtime.getURL("settings.html");
    browser.tabs.create({ url, active: true }).catch((error) => {
      console.error("Failed to open settings:", error);
    });
  };

  const visible = nodes.slice(0, MAX_RESULTS);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search Trail"
      description="Search nodes, jump between trees, or run commands"
    >
      <CommandInput
        placeholder="Search nodes or type a command..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        {visible.length > 0 && (
          <CommandGroup heading="Nodes">
            {visible.map((entry) => (
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
          {visible[0] && (
            <CommandItem
              value="open first result in new tab"
              onSelect={() => {
                const first = visible[0];
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
