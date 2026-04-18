import { memo, useCallback, useMemo } from "react";
import type { NavigationNode, NodeData } from "@shared/types/node.js";
import type { TreeNode } from "@background/state/tree-node.js";
import type { NodeId } from "@shared/types/ids.js";
import { getFaviconUrl } from "@shared/utils/favicon.js";
import { navigateTo } from "../../api/tree.js";
import { togglePin } from "../../api/actions.js";
import { useStore } from "../state/store.js";
import { useOverlayEffects } from "../state/overlay-effects.js";
import { Icons } from "./Icon.js";
import { showOperationError } from "../shared/show-operation-error.js";
import { displayLabel, formatHost } from "../shared/format.js";
import { Button } from "@ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from "@ui/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@ui/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@ui/components/ui/popover";
import { ButtonTooltip } from "@ui/components/button-tooltip";

type NavNode = TreeNode<NodeData> | NavigationNode;

const PINNED_KEYS = ["shift", "P"] as const;
const SEARCH_THRESHOLD = 6;

export default function PinnedDropdown() {
  const pins = useStore((s) => s.pins);
  const tree = useStore((s) => s.tree);
  const open = useStore((s) => s.ui.pinnedOpen);
  const setOpen = useStore((s) => s.setPinnedOpen);

  useOverlayEffects(open, { kind: "dropdown" });

  const pinnedNodes = useMemo<NavNode[]>(() => (pins ? Array.from(pins.pinned) : []), [pins]);

  const handleNavigate = useCallback(
    async (nodeId: NodeId) => {
      const node = tree?.findNodeById(nodeId);
      if (!node) return;
      try {
        await navigateTo(node);
        setOpen(false);
      } catch (error) {
        showOperationError("Open page", error);
      }
    },
    [tree, setOpen],
  );

  const handleUnpin = useCallback(async (nodeId: NodeId) => {
    try {
      await togglePin(nodeId);
    } catch (error) {
      showOperationError("Unpin", error);
    }
  }, []);

  const showSearch = pinnedNodes.length > SEARCH_THRESHOLD;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ButtonTooltip label="Pinned pages" keys={PINNED_KEYS}>
        <PopoverTrigger asChild>
          <Button
            id="pinnedBtn"
            variant="outline"
            size="icon"
            type="button"
            aria-label="Pinned pages"
          >
            <Icons.Pin />
          </Button>
        </PopoverTrigger>
      </ButtonTooltip>
      <PopoverContent
        align="start"
        className="flex max-h-[min(var(--radix-popover-content-available-height),560px)] w-[340px] flex-col gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command
          className="flex size-full min-h-0 flex-1 flex-col rounded-none! bg-transparent p-0! [&_[data-slot=command-input-wrapper]]:pb-2"
          shouldFilter={showSearch}
          loop
        >
          <header className="text-muted-foreground flex shrink-0 items-center gap-1.5 border-b px-3 py-2 text-xs font-medium tracking-wide">
            <Icons.Pin className="size-3.5 opacity-70" />
            <span>Pinned</span>
            {pinnedNodes.length > 0 && (
              <span className="ml-auto tabular-nums opacity-70">{pinnedNodes.length}</span>
            )}
          </header>

          {showSearch && (
            <CommandInput
              placeholder="Search pinned…"
              className="placeholder:text-muted-foreground/70"
            />
          )}

          {pinnedNodes.length === 0 ? (
            <EmptyPinned />
          ) : (
            <CommandList id="pinnedList" className="max-h-none min-h-0 flex-1 overflow-y-auto">
              <CommandEmpty className="text-muted-foreground py-6 text-center text-xs">
                Nothing matches
              </CommandEmpty>
              <CommandGroup className="p-1">
                {pinnedNodes.map((node) => (
                  <PinnedRow
                    key={node.id}
                    node={node}
                    onNavigate={handleNavigate}
                    onUnpin={handleUnpin}
                  />
                ))}
              </CommandGroup>
            </CommandList>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function EmptyPinned() {
  return (
    <Empty className="border-0 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icons.Bookmark />
        </EmptyMedia>
        <EmptyTitle className="text-sm">No pinned pages yet</EmptyTitle>
        <EmptyDescription>Right-click a node in the graph to pin it</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

const PinnedRow = memo(function PinnedRow({
  node,
  onNavigate,
  onUnpin,
}: {
  node: NavNode;
  onNavigate: (id: NodeId) => void | Promise<void>;
  onUnpin: (id: NodeId) => void | Promise<void>;
}) {
  const title = displayLabel({
    title: node.data.title ?? null,
    url: node.data.url ?? null,
  });
  const host = formatHost(node.data.url);
  const showHost = host && host !== title;

  const searchValue = `${node.id} ${title} ${host ?? ""}`;

  return (
    <CommandPrimitive.Item
      value={searchValue}
      onSelect={() => void onNavigate(node.id as NodeId)}
      data-node-id={node.id}
      className="group/pin data-[selected=true]:bg-accent relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none select-none"
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        {node.data.url ? (
          <img className="size-4 rounded-sm" alt="" src={getFaviconUrl(node.data.url)} />
        ) : (
          <Icons.Pin className="text-muted-foreground size-4" />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate leading-tight">{title}</span>
        {showHost && (
          <span className="text-muted-foreground truncate text-[11px] leading-tight">{host}</span>
        )}
      </span>

      <ButtonTooltip label="Unpin">
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          aria-label="Unpin"
          className="text-muted-foreground hover:text-foreground shrink-0 opacity-0 transition-opacity group-hover/pin:opacity-100 group-data-[selected=true]/pin:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            void onUnpin(node.id as NodeId);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Icons.X />
        </Button>
      </ButtonTooltip>
    </CommandPrimitive.Item>
  );
});
