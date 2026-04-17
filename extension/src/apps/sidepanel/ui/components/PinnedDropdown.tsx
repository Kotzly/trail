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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@ui/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@ui/components/ui/item";
import { Popover, PopoverContent, PopoverTrigger } from "@ui/components/ui/popover";
import { ScrollArea } from "@ui/components/ui/scroll-area";
import { ButtonTooltip } from "@ui/components/button-tooltip";

type NavNode = TreeNode<NodeData> | NavigationNode;

const PINNED_KEYS = ["shift", "P"] as const;

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

  const handleEnter = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const first = pinnedNodes[0];
      if (first) {
        e.preventDefault();
        void handleNavigate(first.id as NodeId);
      }
    },
    [pinnedNodes, handleNavigate],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ButtonTooltip label="Pinned pages" keys={PINNED_KEYS}>
        <PopoverTrigger asChild>
          <Button
            id="pinnedBtn"
            variant="outline"
            size="icon-sm"
            type="button"
            aria-label="Pinned pages"
          >
            <Icons.Pin />
          </Button>
        </PopoverTrigger>
      </ButtonTooltip>
      <PopoverContent
        align="start"
        className="w-[320px] overflow-hidden p-0"
        onKeyDown={handleEnter}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="text-muted-foreground border-b px-3 py-2 text-xs font-medium tracking-wide">
          Pinned
          {pinnedNodes.length > 0 && (
            <span className="text-muted-foreground/70 ml-1.5 tabular-nums">
              {pinnedNodes.length}
            </span>
          )}
        </div>
        <ScrollArea className="max-h-[320px] [&>[data-radix-scroll-area-viewport]>div]:!block">
          {pinnedNodes.length === 0 ? (
            <EmptyPinned />
          ) : (
            <ItemGroup className="p-1" id="pinnedList">
              {pinnedNodes.map((node) => (
                <PinnedRow
                  key={node.id}
                  node={node}
                  onNavigate={handleNavigate}
                  onUnpin={handleUnpin}
                />
              ))}
            </ItemGroup>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Hoisted — static tree, never re-constructed on parent re-render
 * (`rendering-hoist-jsx`).
 */
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

/**
 * Memoized so sibling re-renders (parent state change, graph update,
 * another pin/unpin) don't ripple through the whole list — only the row
 * whose `node` identity changed actually re-renders
 * (`rerender-memo` + `rerender-functional-setstate`).
 */
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

  return (
    <Item
      size="xs"
      className="hover:bg-accent group/row cursor-pointer border-transparent"
      data-node-id={node.id}
      onClick={() => void onNavigate(node.id as NodeId)}
    >
      <ItemMedia variant="icon">
        {node.data.url ? (
          <img className="size-4 rounded-sm" alt="" src={getFaviconUrl(node.data.url)} />
        ) : (
          <Icons.Pin className="text-muted-foreground size-4" />
        )}
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="block w-full truncate text-[13px]">{title}</ItemTitle>
        {showHost ? <ItemDescription className="text-[11px]">{host}</ItemDescription> : null}
      </ItemContent>
      <ItemActions className="opacity-0 transition-opacity group-hover/row:opacity-100">
        <ButtonTooltip label="Unpin">
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            aria-label="Unpin"
            onClick={(e) => {
              e.stopPropagation();
              void onUnpin(node.id as NodeId);
            }}
          >
            <Icons.X />
          </Button>
        </ButtonTooltip>
      </ItemActions>
    </Item>
  );
});
