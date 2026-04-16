import { useMemo } from "react";
import type { NodeId } from "@shared/types/ids.js";
import { getFaviconUrl } from "@shared/utils/favicon.js";
import { navigateTo } from "../../api/tree.js";
import { useStore } from "../state/store.js";
import { useOverlayEffects } from "../state/overlay-effects.js";
import { Icons } from "./Icon.js";
import { showOperationError } from "../shared/show-operation-error.js";
import { displayLabel, formatHost } from "../shared/format.js";
import { Button } from "@ui/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@ui/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@ui/components/ui/item";
import { Popover, PopoverContent, PopoverTrigger } from "@ui/components/ui/popover";
import { ScrollArea } from "@ui/components/ui/scroll-area";
import { Separator } from "@ui/components/ui/separator";

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
        <CardHeader className="px-3 py-2.5">
          <CardTitle className="text-[13px]">Pinned</CardTitle>
          <CardDescription className="text-[11px]" id="pinnedCount">
            {pinnedNodes.length} {pinnedNodes.length === 1 ? "page" : "pages"}
          </CardDescription>
        </CardHeader>
        <Separator />
        <ScrollArea className="max-h-[320px]">
          {pinnedNodes.length === 0 ? (
            <Empty className="border-0 py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Icons.Bookmark />
                </EmptyMedia>
                <EmptyTitle className="text-sm">No pinned pages yet</EmptyTitle>
                <EmptyDescription>Right-click a node in the graph to pin it</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup className="gap-0.5 p-1" id="pinnedList">
              {pinnedNodes.map((node) => {
                const title = displayLabel({
                  title: node.data.title ?? null,
                  url: node.data.url ?? null,
                });
                const host = formatHost(node.data.url);
                return (
                  <Item
                    key={node.id}
                    variant="default"
                    size="xs"
                    className="hover:bg-accent cursor-pointer border-transparent"
                    data-node-id={node.id}
                    onClick={() => void handleNavigate(node.id as NodeId)}
                  >
                    <ItemMedia variant="icon">
                      {node.data.url ? (
                        <img
                          className="size-4 rounded-sm"
                          alt=""
                          src={getFaviconUrl(node.data.url)}
                        />
                      ) : (
                        <Icons.Pin className="text-muted-foreground size-4" />
                      )}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="text-[13px]">{title}</ItemTitle>
                      {host && host !== title ? (
                        <ItemDescription className="text-[11px]">{host}</ItemDescription>
                      ) : null}
                    </ItemContent>
                  </Item>
                );
              })}
            </ItemGroup>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
