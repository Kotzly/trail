import { useMemo } from "react";
import type { NodeId } from "@shared/types/ids.js";
import { getFaviconUrl } from "@shared/utils/favicon.js";
import { navigateTo } from "../../api/tree.js";
import { useStore } from "../state/store.js";
import { useOverlayEffects } from "../state/overlay-effects.js";
import { Icons } from "./Icon.js";
import { showOperationError } from "../shared/show-operation-error.js";
import { Button } from "@ui/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@ui/components/ui/popover";
import { ScrollArea } from "@ui/components/ui/scroll-area";

export default function PinnedDropdown() {
  const pins = useStore((state) => state.pins);
  const tree = useStore((state) => state.tree);
  const pinnedOpen = useStore((state) => state.ui.pinnedOpen);
  const setPinnedOpen = useStore((state) => state.setPinnedOpen);
  const pinnedShortcut = "Shift+P";
  const pinnedTooltip = `Pinned pages (${pinnedShortcut})`;

  useOverlayEffects(pinnedOpen, { kind: "dropdown" });

  const pinnedNodes = useMemo(() => {
    if (!pins) return [];
    return Array.from(pins.pinned);
  }, [pins]);

  const handleNavigate = async (nodeId: NodeId) => {
    const node = tree?.findNodeById(nodeId);
    if (!node) return;
    try {
      await navigateTo(node);
      setPinnedOpen(false);
    } catch (error) {
      showOperationError("Open page", error);
    }
  };

  return (
    <Popover open={pinnedOpen} onOpenChange={setPinnedOpen}>
      <PopoverTrigger asChild>
        <Button
          id="pinnedBtn"
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={pinnedTooltip}
          data-tooltip={pinnedTooltip}
        >
          <Icons.Pin />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-0"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const node = pinnedNodes[0];
            if (node) void handleNavigate(node.id as NodeId);
          }
        }}
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold">pinned</span>
            <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full" id="pinnedCount">
              {pinnedNodes.length}
            </span>
          </div>
        </div>
        <ScrollArea className="max-h-[300px]">
          <div className="p-1" id="pinnedList">
            {pinnedNodes.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-6 text-muted-foreground">
                <Icons.Bookmark className="size-6 opacity-40" />
                <span className="text-[13px]">No pinned pages yet</span>
                <span className="text-[11px] opacity-60">Right-click a node to pin it</span>
              </div>
            ) : (
              pinnedNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-left hover:bg-accent transition-colors"
                  data-node-id={node.id}
                  onClick={() => void handleNavigate(node.id as NodeId)}
                >
                  {node.data.url ? (
                    <img
                      className="size-4 rounded-sm shrink-0"
                      alt=""
                      src={getFaviconUrl(node.data.url)}
                    />
                  ) : (
                    <div className="size-4 rounded-sm shrink-0 flex items-center justify-center bg-muted">
                      <Icons.Pin className="size-2.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] truncate">{node.data.title || "Untitled"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {(() => {
                        try {
                          return new URL(node.data.url).hostname;
                        } catch {
                          return node.data.url || "";
                        }
                      })()}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
