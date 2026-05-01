import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClipboard } from "@ui/hooks/use-clipboard";
import type { NodeId, TabId, Url } from "@shared/types/ids.js";
import { getFaviconUrl } from "@shared/utils/favicon.js";
import { navigateTo } from "../../api/tree.js";
import { getTabsForNodeMessage } from "../../api/tabs.js";
import {
  bulkCloseTabs,
  bulkPin,
  bulkUnpin,
  closeTab,
  deleteChildren,
  fireAndForget,
  openInNewTab,
  toggleMute,
  togglePin,
} from "../../api/actions.js";
import { useStore } from "../state/store.js";
import { useOverlayEffects } from "../state/overlay-effects.js";
import { Icons } from "./Icon.js";
import { useDeleteFlow } from "../hooks/useDeleteFlow.js";
import { Button } from "@ui/components/ui/button";
import { ButtonGroup } from "@ui/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/components/ui/dropdown-menu";
import { ScrollArea } from "@ui/components/ui/scroll-area";
import { Shortcut, type ShortcutKey } from "@ui/components/shortcut";

import { toast } from "sonner";
import { i18n } from "#i18n";
import { browser, type Tab } from "@shared/platform/webext.js";
import { showOperationError } from "../shared/show-operation-error.js";
import { compileCollapselist } from "@shared/lib/url-blocklist.js";
import { computeChainFoldInfo } from "@features/graph/fold-chains.js";

export default function ContextMenus() {
  const contextMenu = useStore((state) => state.contextMenu);
  useOverlayEffects(Boolean(contextMenu), { kind: "context" });

  const tree = useStore((state) => state.tree);

  if (!contextMenu) return null;

  if (contextMenu.type === "node") {
    const node = tree?.findNodeById(contextMenu.nodeId);
    if (!node) return null;
    return (
      <NodeContextMenu
        key={`${contextMenu.nodeId}-${contextMenu.position.x}-${contextMenu.position.y}`}
        nodeId={contextMenu.nodeId}
        position={contextMenu.position}
      />
    );
  }

  return (
    <BulkContextMenu
      key={`bulk-${contextMenu.nodeIds.join(",")}-${contextMenu.position.x}-${contextMenu.position.y}`}
      nodeIds={contextMenu.nodeIds}
      position={contextMenu.position}
    />
  );
}

/**
 * Right-click opens the menu via `contextmenu`, then the browser delivers
 * `pointerup` to whatever lies under the cursor — usually a menu item. Radix's
 * `MenuItem` interprets a pointerup it didn't see a matching pointerdown for
 * as a synthetic click and fires `onSelect`, which dismisses the menu and may
 * trigger an action. We swallow the first pointerup with `preventDefault()` so
 * `composeEventHandlers` skips Radix's internal handler.
 */
function useSwallowFirstPointerUp() {
  const armedRef = useRef(true);
  return useCallback((event: React.PointerEvent) => {
    if (armedRef.current) {
      armedRef.current = false;
      event.preventDefault();
    }
  }, []);
}

type VirtualTriggerProps = { position: { x: number; y: number } };

function VirtualTrigger({ position }: VirtualTriggerProps) {
  return (
    <DropdownMenuTrigger asChild>
      <span
        aria-hidden
        className="pointer-events-none fixed"
        style={{ left: position.x, top: position.y, width: 0, height: 0 }}
      />
    </DropdownMenuTrigger>
  );
}

function MenuShortcut({ keys }: { keys: readonly ShortcutKey[] }) {
  return (
    <Shortcut
      keys={keys}
      className="ml-auto pl-3 [&_kbd]:h-6 [&_kbd]:min-w-6 [&_kbd]:px-1.5 [&_kbd]:text-sm [&_kbd]:uppercase"
    />
  );
}

/**
 * Plain destructive menu item: single click → action fires, toast with
 * Undo handles obvious mistakes. The two-step "armed/confirm" pattern
 * was removed (it required two clicks for every delete and made
 * deletion feel onerous; toast-Undo gives the same safety with less
 * friction).
 */
type DestructiveActionItemProps = {
  label: string;
  description?: string | null;
  onAction: () => void;
  icon?: React.ReactNode;
  shortcut?: readonly ShortcutKey[];
};

function DestructiveActionItem({
  label,
  description,
  onAction,
  icon,
  shortcut,
}: DestructiveActionItemProps) {
  return (
    <DropdownMenuItem
      variant="destructive"
      className={description ? "items-start py-1.5" : undefined}
      onSelect={() => onAction()}
    >
      {icon ?? <Icons.Trash2 className={description ? "mt-0.5" : undefined} />}
      <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
        <span>{label}</span>
        {description && <span className="text-[11px] opacity-75">{description}</span>}
      </span>
      {shortcut && <MenuShortcut keys={shortcut} />}
    </DropdownMenuItem>
  );
}

type TabRowProps = {
  tab: Tab;
  onActivate: () => void;
  onMute: () => void;
  onClose: () => void;
};

function TabRow({ tab, onActivate, onMute, onClose }: TabRowProps) {
  const muted = Boolean(tab.mutedInfo?.muted);
  const displayUrl = tab.url
    ? String(tab.url)
        .replace(/^https?:\/\/(www\.)?/, "")
        .replace(/\/$/, "")
    : "";
  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        onActivate();
      }}
    >
      {tab.url && (
        <img
          className="size-4 shrink-0"
          src={getFaviconUrl(tab.url as Url)}
          alt=""
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
      )}
      <div className="flex w-48 flex-col">
        <span className="truncate text-xs">{tab.title || i18n.t("menus.untitledTab")}</span>
        {displayUrl && (
          <span className="text-muted-foreground truncate text-[10px]">{displayUrl}</span>
        )}
      </div>
      <ButtonGroup>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={muted ? i18n.t("menus.unmuteTab") : i18n.t("menus.muteTab")}
          onClick={(e) => {
            e.stopPropagation();
            onMute();
          }}
          className="press-feedback"
        >
          {muted ? <Icons.VolumeX /> : <Icons.Volume2 />}
        </Button>
        <Button
          variant="destructive"
          size="icon-xs"
          aria-label={i18n.t("menus.closeTab")}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="press-feedback"
        >
          <Icons.X />
        </Button>
      </ButtonGroup>
    </DropdownMenuItem>
  );
}

type NodeMenuProps = { nodeId: NodeId; position: { x: number; y: number } };

function NodeContextMenu({ nodeId, position }: NodeMenuProps) {
  const closeContextMenu = useStore((state) => state.closeContextMenu);
  const setHoverNodeId = useStore((state) => state.setHoverNodeId);
  const tree = useStore((state) => state.tree);
  const treeJSON = useStore((state) => state.treeJSON);
  const collapsedNodeIds = useStore((state) => state.graph.collapsedNodeIds);
  const unfoldedChainIds = useStore((state) => state.graph.unfoldedChainIds);
  const settings = useStore((state) => state.settings);
  const collapseNodes = useStore((state) => state.collapseNodes);
  const expandNodes = useStore((state) => state.expandNodes);
  const toggleChainUnfolded = useStore((state) => state.toggleChainUnfolded);
  const trees = useStore((state) => state.trees);
  const { request: requestDelete } = useDeleteFlow();
  const node = tree?.findNodeById(nodeId);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const { copy: copyToClipboard } = useClipboard();

  useEffect(() => {
    let mounted = true;
    getTabsForNodeMessage(nodeId)
      .then((res) => {
        if (mounted) setTabs(res);
      })
      .catch((error) => console.error("Failed to get tabs for node:", error));
    return () => {
      mounted = false;
    };
  }, [nodeId]);

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setHoverNodeId(null);
        closeContextMenu();
      }
    },
    [closeContextMenu, setHoverNodeId],
  );

  // Chain-fold info for the right-clicked node. Recomputed on each
  // open from the live store; cheap (one tree walk + regex tests) and
  // saves having to thread fold state through context-menu props.
  const collapselist = settings?.privacy.collapselist;
  const chainState = useMemo(() => {
    if (!treeJSON || !collapselist || collapselist.length === 0) {
      return { foldedCount: 0, isUnfolded: false };
    }
    const matcher = compileCollapselist(collapselist);
    const info = computeChainFoldInfo(treeJSON, matcher, unfoldedChainIds);
    return {
      foldedCount: info.tipFoldCounts.get(nodeId) ?? 0,
      isUnfolded: info.unfoldedTipIds.has(nodeId),
    };
  }, [treeJSON, collapselist, unfoldedChainIds, nodeId]);

  const swallowFirstPointerUp = useSwallowFirstPointerUp();

  if (!node) return null;

  const hasOpenTab = tabs.length > 0;
  const hasTitle = Boolean(node.data.title && node.data.title.trim().length > 0);
  const hasChildren = (node.getChildren?.() ?? []).length > 0;
  const isRoot = node.isRoot();
  const isCollapsed = collapsedNodeIds.has(nodeId);

  const closeAllTabsForNode = () => {
    fireAndForget(bulkCloseTabs([nodeId]), "bulk close tabs");
    setTabs([]);
  };

  return (
    <DropdownMenu open modal={false} onOpenChange={onOpenChange}>
      <VirtualTrigger position={position} />
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={0}
        collisionPadding={8}
        onPointerUpCapture={swallowFirstPointerUp}
        className="**:data-[slot$=-item]:hover:bg-foreground/10 **:data-[slot$=-trigger]:hover:bg-foreground/10 w-auto min-w-48 data-closed:duration-[80ms] data-closed:ease-(--ease-out) data-open:duration-[100ms] data-open:ease-(--ease-out)"
      >
        <DropdownMenuItem
          onSelect={async () => {
            try {
              await navigateTo(node);
            } catch (error) {
              showOperationError(i18n.t("menus.openPageOp"), error);
            }
          }}
        >
          <Icons.ArrowRight />
          {i18n.t("menus.openInThisTab")}
          <MenuShortcut keys={["enter"]} />
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => fireAndForget(openInNewTab(nodeId), "open in new tab")}>
          <Icons.ExternalLink />
          {i18n.t("menus.openInNewTab")}
          <MenuShortcut keys={["meta", "enter"]} />
        </DropdownMenuItem>

        {hasOpenTab && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              {tabs.length === 1
                ? i18n.t("menus.openTabsOne", [String(tabs.length)])
                : i18n.t("menus.openTabsMany", [String(tabs.length)])}
            </DropdownMenuLabel>
            <ScrollArea
              className="max-h-[200px]"
              onMouseEnter={() => setHoverNodeId(nodeId)}
              onMouseLeave={() => setHoverNodeId(null)}
            >
              {tabs.map((tab) => (
                <TabRow
                  key={tab.id}
                  tab={tab}
                  onActivate={() => {
                    if (tab.id)
                      browser.tabs
                        .update(tab.id, { active: true })
                        .catch((error) => console.error("Failed to focus tab:", error));
                  }}
                  onMute={() => {
                    if (!tab.id) return;
                    fireAndForget(toggleMute(nodeId, tab.id as TabId), "toggle mute");
                    setTabs((prev) =>
                      prev.map((item) =>
                        item.id === tab.id
                          ? {
                              ...item,
                              mutedInfo: {
                                ...item.mutedInfo,
                                muted: !item.mutedInfo?.muted,
                              },
                            }
                          : item,
                      ),
                    );
                  }}
                  onClose={() => {
                    if (!tab.id) return;
                    fireAndForget(closeTab(nodeId, tab.id as TabId), "close tab");
                    setTabs((prev) => prev.filter((item) => item.id !== tab.id));
                  }}
                />
              ))}
            </ScrollArea>
            {tabs.length > 1 && (
              <DropdownMenuItem variant="destructive" onSelect={closeAllTabsForNode}>
                <Icons.X />
                {i18n.t("menus.closeAllTabs")}
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => fireAndForget(togglePin(nodeId), "toggle pin")}>
          {node.data.pinned ? <Icons.PinOff /> : <Icons.Pin />}
          {node.data.pinned ? i18n.t("menus.unpin") : i18n.t("menus.pin")}
          <MenuShortcut keys={["p"]} />
        </DropdownMenuItem>

        {hasChildren && !isCollapsed && (
          <DropdownMenuItem onSelect={() => collapseNodes([nodeId])}>
            <Icons.FoldVertical />
            {i18n.t("menus.collapseNode")}
          </DropdownMenuItem>
        )}
        {isCollapsed && (
          <DropdownMenuItem onSelect={() => expandNodes([nodeId])}>
            <Icons.UnfoldVertical />
            {i18n.t("menus.expandNode")}
          </DropdownMenuItem>
        )}

        {chainState.foldedCount > 0 && (
          <DropdownMenuItem onSelect={() => toggleChainUnfolded(nodeId)}>
            <Icons.UnfoldVertical />
            {i18n.t("menus.unfoldChain", [String(chainState.foldedCount)])}
          </DropdownMenuItem>
        )}
        {chainState.isUnfolded && (
          <DropdownMenuItem onSelect={() => toggleChainUnfolded(nodeId)}>
            <Icons.FoldVertical />
            {i18n.t("menus.refoldChain")}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onSelect={() => useStore.getState().startInlineRename(nodeId)}>
          <Icons.Pencil />
          {i18n.t("menus.rename")}
          <MenuShortcut keys={["F2"]} />
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={async () => {
            await copyToClipboard(node.data.url);
            toast.success(i18n.t("menus.urlCopied"));
          }}
        >
          <Icons.Link />
          {i18n.t("menus.copyUrl")}
        </DropdownMenuItem>
        {hasTitle && (
          <DropdownMenuItem
            onSelect={async () => {
              await copyToClipboard(node.data.title || i18n.t("menus.untitled"));
              toast.success(i18n.t("menus.titleCopied"));
            }}
          >
            <Icons.Type />
            {i18n.t("menus.copyTitle")}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {isRoot ? (
          <DestructiveActionItem
            label={i18n.t("menus.deleteTree")}
            onAction={() => {
              const treeId = trees.active?.id;
              if (!treeId) return;
              void requestDelete({ kind: "tree", treeId }, { source: "context" });
            }}
          />
        ) : (
          <>
            {/* Collapsed-aware: a collapsed node represents itself + all
                hidden descendants. Showing only "Delete subtree" (with
                count) prevents the user from accidentally orphaning N
                hidden children with a misleading "Delete node" click. */}
            {!isCollapsed && (
              <DestructiveActionItem
                label={i18n.t("menus.deleteNode")}
                onAction={() =>
                  void requestDelete(
                    { kind: "node", nodeIds: [nodeId], recursive: false },
                    { source: "context" },
                  )
                }
                shortcut={["delete"]}
              />
            )}
            {hasChildren && !isCollapsed && (
              <DestructiveActionItem
                label={i18n.t("menus.deleteChildren")}
                onAction={() => fireAndForget(deleteChildren(nodeId), "delete children")}
              />
            )}
            {(hasChildren || isCollapsed) && (
              <DestructiveActionItem
                label={i18n.t("menus.deleteSubtree")}
                onAction={() =>
                  void requestDelete(
                    { kind: "node", nodeIds: [nodeId], recursive: true },
                    { source: "context" },
                  )
                }
                shortcut={["shift", "delete"]}
              />
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type BulkMenuProps = { nodeIds: NodeId[]; position: { x: number; y: number } };

function BulkContextMenu({ nodeIds, position }: BulkMenuProps) {
  const closeContextMenu = useStore((state) => state.closeContextMenu);
  const clearSelection = useStore((state) => state.clearSelection);
  const tree = useStore((state) => state.tree);
  const collapsedNodeIds = useStore((state) => state.graph.collapsedNodeIds);
  const collapseNodes = useStore((state) => state.collapseNodes);
  const expandNodes = useStore((state) => state.expandNodes);
  const { request: requestDelete } = useDeleteFlow();
  const { copy: copyToClipboard } = useClipboard();

  const selectedNodes = useMemo(() => {
    if (!tree) return [];
    return nodeIds
      .map((id) => tree.findNodeById(id))
      .filter((node): node is NonNullable<typeof node> => Boolean(node));
  }, [nodeIds, tree]);

  const allPinned = selectedNodes.length > 0 && selectedNodes.every((node) => node.data.pinned);

  const collapseCandidates = useMemo(
    () =>
      selectedNodes.filter(
        (node) => (node.getChildren?.() ?? []).length > 0 && !collapsedNodeIds.has(node.id),
      ),
    [collapsedNodeIds, selectedNodes],
  );
  const expandCandidates = useMemo(
    () => selectedNodes.filter((node) => collapsedNodeIds.has(node.id)),
    [collapsedNodeIds, selectedNodes],
  );

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) closeContextMenu();
    },
    [closeContextMenu],
  );

  // Show "Delete nodes" only when none of the selected are collapsed.
  // A collapsed node forces recursive (see resolveDeleteTarget) so a
  // non-recursive item would silently behave as recursive — confusing.
  const anyCollapsed = nodeIds.some((id) => collapsedNodeIds.has(id));

  const swallowFirstPointerUp = useSwallowFirstPointerUp();

  return (
    <DropdownMenu open modal={false} onOpenChange={onOpenChange}>
      <VirtualTrigger position={position} />
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={0}
        collisionPadding={8}
        onPointerUpCapture={swallowFirstPointerUp}
        className="**:data-[slot$=-item]:hover:bg-foreground/10 **:data-[slot$=-trigger]:hover:bg-foreground/10 w-auto max-w-60 min-w-48 data-closed:duration-[80ms] data-closed:ease-(--ease-out) data-open:duration-[100ms] data-open:ease-(--ease-out)"
      >
        <DropdownMenuLabel>
          {nodeIds.length === 1
            ? i18n.t("menus.nodesSelectedOne", [String(nodeIds.length)])
            : i18n.t("menus.nodesSelectedMany", [String(nodeIds.length)])}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            fireAndForget(allPinned ? bulkUnpin(nodeIds) : bulkPin(nodeIds), "bulk pin toggle");
            clearSelection();
          }}
        >
          {allPinned ? <Icons.PinOff /> : <Icons.Pin />}
          {allPinned ? i18n.t("menus.unpinSelected") : i18n.t("menus.pinSelected")}
          <MenuShortcut keys={["p"]} />
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={collapseCandidates.length === 0}
          onSelect={() => {
            if (collapseCandidates.length === 0) return;
            collapseNodes(collapseCandidates.map((node) => node.id));
            clearSelection();
          }}
        >
          <Icons.FoldVertical />
          {i18n.t("menus.collapseSelected")}
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={expandCandidates.length === 0}
          onSelect={() => {
            if (expandCandidates.length === 0) return;
            expandNodes(expandCandidates.map((node) => node.id));
            clearSelection();
          }}
        >
          <Icons.UnfoldVertical />
          {i18n.t("menus.expandSelected")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={async () => {
            const urls = selectedNodes.map((node) => node.data.url).filter(Boolean);
            if (urls.length === 0) return;
            await copyToClipboard(urls.join("\n"));
            toast.success(
              urls.length === 1
                ? i18n.t("menus.urlsCopiedOne", [String(urls.length)])
                : i18n.t("menus.urlsCopiedMany", [String(urls.length)]),
            );
          }}
        >
          <Icons.Link />
          {i18n.t("menus.copyUrls")}
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => {
            fireAndForget(bulkCloseTabs(nodeIds), "bulk close tabs");
            clearSelection();
          }}
        >
          <Icons.X />
          {i18n.t("menus.closeSelectedTabs")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {!anyCollapsed && (
          <DestructiveActionItem
            label={i18n.t("menus.deleteNodes")}
            onAction={() =>
              void requestDelete({ kind: "node", nodeIds, recursive: false }, { source: "context" })
            }
            shortcut={["delete"]}
          />
        )}
        <DestructiveActionItem
          label={i18n.t("menus.deleteSubtrees")}
          onAction={() =>
            void requestDelete({ kind: "node", nodeIds, recursive: true }, { source: "context" })
          }
          shortcut={["shift", "delete"]}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
