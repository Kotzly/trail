import { memo, useCallback, useMemo } from "react";
import type { NavigationNode, NodeData } from "@shared/types/node.js";
import type { TreeNode } from "@background/state/tree-node.js";
import type { NodeId } from "@shared/types/ids.js";
import { getFaviconUrl } from "@shared/utils/favicon.js";
import { navigateTo } from "../../api/tree.js";
import { useStore } from "../state/store.js";
import { useOverlayEffects } from "../state/overlay-effects.js";
import { Icons } from "./Icon.js";
import { showOperationError } from "../shared/show-operation-error.js";
import { displayLabel, formatHost } from "../shared/format.js";
import { Button } from "@ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
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

type NavNode = TreeNode<NodeData> | NavigationNode;

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
      <PopoverTrigger asChild>
        <Button
          id="pinnedBtn"
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label="Pinned pages (Shift+P)"
          data-tooltip="Pinned pages (Shift+P)"
        >
          <Icons.Pin />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0" onKeyDown={handleEnter}>
        <Card className="rounded-none border-0 shadow-none ring-0">
          <CardHeader>
            <CardTitle>Pinned</CardTitle>
            <CardDescription id="pinnedCount">
              {pinnedNodes.length} {pinnedNodes.length === 1 ? "page" : "pages"}
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <ScrollArea className="max-h-[320px]">
              {pinnedNodes.length === 0 ? (
                <EmptyPinned />
              ) : (
                <ItemGroup className="p-1" id="pinnedList">
                  {pinnedNodes.map((node) => (
                    <PinnedRow key={node.id} node={node} onNavigate={handleNavigate} />
                  ))}
                </ItemGroup>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
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
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icons.Bookmark />
        </EmptyMedia>
        <EmptyTitle>No pinned pages yet</EmptyTitle>
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
}: {
  node: NavNode;
  onNavigate: (id: NodeId) => void | Promise<void>;
}) {
  const title = displayLabel({
    title: node.data.title ?? null,
    url: node.data.url ?? null,
  });
  const host = formatHost(node.data.url);
  const showHost = host && host !== title;

  return (
    <Item
      variant="default"
      size="xs"
      className="hover:bg-accent cursor-pointer border-transparent"
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
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        {showHost ? <ItemDescription>{host}</ItemDescription> : null}
      </ItemContent>
    </Item>
  );
});
