import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeId, TabId, Url } from "@shared/types/ids.js";
import { getFaviconUrl } from "@shared/utils/favicon.js";
import { cn } from "@ui/lib/utils";
import { navigateTo } from "../../api/tree.js";
import { getTabsForNodeMessage } from "../../api/tabs.js";
import {
  bulkCloseTabs,
  bulkDeleteNodes,
  bulkDeleteRecursive,
  bulkPin,
  bulkUnpin,
  closeTab,
  deleteChildren,
  deleteNode,
  deleteWithChildren,
  fireAndForget,
  openInNewTab,
  toggleMute,
  togglePin,
} from "../../api/actions.js";
import { useStore } from "../state/store.js";
import { useOverlayEffects } from "../state/overlay-effects.js";
import { Icons } from "./Icon.js";
import { getIncludedRootId } from "../shared/delete-tree.js";
import { Badge } from "@ui/components/ui/badge";
import { Button } from "@ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/components/ui/dropdown-menu";
import { ScrollArea } from "@ui/components/ui/scroll-area";

import { toast } from "sonner";
import { browser, type Tab } from "@shared/platform/webext.js";
import { showOperationError } from "../shared/show-operation-error.js";

export default function ContextMenus() {
  const contextMenu = useStore((state) => state.contextMenu);
  useOverlayEffects(Boolean(contextMenu), { kind: "context" });

  const tree = useStore((state) => state.tree);

  if (!contextMenu) return null;

  if (contextMenu.type === "node") {
    const node = tree?.findNodeById(contextMenu.nodeId);
    if (!node) return null;
    return <NodeContextMenu nodeId={contextMenu.nodeId} position={contextMenu.position} />;
  }

  return <BulkContextMenu nodeIds={contextMenu.nodeIds} position={contextMenu.position} />;
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

type NodeMenuProps = { nodeId: NodeId; position: { x: number; y: number } };

function NodeContextMenu({ nodeId, position }: NodeMenuProps) {
  const closeContextMenu = useStore((state) => state.closeContextMenu);
  const setHoverNodeId = useStore((state) => state.setHoverNodeId);
  const setPickTarget = useStore((state) => state.setPickTarget);
  const tree = useStore((state) => state.tree);
  const openDeleteTreeConfirm = useStore((state) => state.openDeleteTreeConfirm);
  const collapsedNodeIds = useStore((state) => state.graph.collapsedNodeIds);
  const editorActive = useStore((state) => state.editorMode.active);
  const collapseNodes = useStore((state) => state.collapseNodes);
  const expandNodes = useStore((state) => state.expandNodes);
  const node = tree?.findNodeById(nodeId);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [checkedTabId, setCheckedTabId] = useState<number | null>(null);
  const checkTimeoutRef = useRef<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<"node" | "children" | "withChildren" | null>(
    null,
  );
  const [pendingCloseAllTabs, setPendingCloseAllTabs] = useState(false);

  useEffect(() => {
    return () => {
      if (checkTimeoutRef.current !== null) {
        window.clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
    };
  }, [nodeId]);

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

  if (!node) return null;

  const hasOpenTab = tabs.length > 0;
  const hasTitle = Boolean(node.data.title && node.data.title.trim().length > 0);
  const hasChildren = (node.getChildren?.() ?? []).length > 0;
  const isRoot = node.isRoot();
  const isCollapsed = collapsedNodeIds.has(nodeId);

  return (
    <DropdownMenu
      key={`${position.x}-${position.y}`}
      open
      modal={false}
      onOpenChange={onOpenChange}
    >
      <VirtualTrigger position={position} />
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={0}
        collisionPadding={8}
        className="w-auto min-w-40"
      >
        {!editorActive && (
          <>
            <DropdownMenuItem
              onSelect={async () => {
                try {
                  await navigateTo(node);
                } catch (error) {
                  showOperationError("Open page", error);
                }
              }}
            >
              Open in this tab
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => fireAndForget(openInNewTab(nodeId), "open in new tab")}
            >
              Open in new tab
            </DropdownMenuItem>

            {hasOpenTab && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>
                  {tabs.length} open tab{tabs.length !== 1 ? "s" : ""}
                </DropdownMenuLabel>
                <ScrollArea className="max-h-[200px]" onMouseLeave={() => setHoverNodeId(null)}>
                  {tabs.map((tab) => (
                    <DropdownMenuItem
                      key={tab.id}
                      onMouseEnter={() => setHoverNodeId(nodeId)}
                      onMouseLeave={() => setHoverNodeId(null)}
                      onSelect={async (e) => {
                        e.preventDefault();
                        if (!tab.id) return;
                        setCheckedTabId(tab.id);
                        if (checkTimeoutRef.current !== null)
                          window.clearTimeout(checkTimeoutRef.current);
                        checkTimeoutRef.current = window.setTimeout(() => {
                          setCheckedTabId(null);
                          checkTimeoutRef.current = null;
                        }, 650);
                        try {
                          await browser.tabs.update(tab.id, { active: true });
                        } catch (error) {
                          console.error("Failed to focus tab:", error);
                        }
                      }}
                    >
                      {tab.url && (
                        <img
                          className="size-4 shrink-0 rounded-sm"
                          src={getFaviconUrl(tab.url as Url)}
                          alt=""
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.visibility = "hidden";
                          }}
                        />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="line-clamp-1 text-xs">{tab.title || "Untitled tab"}</span>
                        {tab.url && (
                          <span className="text-muted-foreground line-clamp-1 text-[10px]">
                            {tab.url}
                          </span>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        aria-hidden
                        className={cn(
                          "size-5 shrink-0 rounded-full p-0 transition-all",
                          checkedTabId === tab.id
                            ? "scale-100 opacity-100"
                            : "pointer-events-none scale-75 opacity-0",
                        )}
                      >
                        <Icons.Check />
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="rounded-full"
                        aria-label={tab.mutedInfo?.muted ? "Unmute tab" : "Mute tab"}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!tab.id) return;
                          fireAndForget(toggleMute(nodeId, tab.id as TabId), "toggle mute");
                          setTabs((prev) =>
                            prev.map((item) =>
                              item.id === tab.id
                                ? ({
                                    ...item,
                                    mutedInfo: {
                                      muted: !item.mutedInfo?.muted,
                                      reason:
                                        (item.mutedInfo?.reason as
                                          | "user"
                                          | "capture"
                                          | "extension"
                                          | undefined) ?? undefined,
                                    },
                                  } as typeof item)
                                : item,
                            ),
                          );
                        }}
                      >
                        {tab.mutedInfo?.muted ? <Icons.VolumeX /> : <Icons.Volume2 />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                        aria-label="Close tab"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!tab.id) return;
                          fireAndForget(closeTab(nodeId, tab.id as TabId), "close tab");
                          setTabs((prev) => prev.filter((item) => item.id !== tab.id));
                        }}
                      >
                        <Icons.X />
                      </Button>
                    </DropdownMenuItem>
                  ))}
                </ScrollArea>
                {pendingCloseAllTabs ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      if (tabs.length === 1 && tabs[0]?.id)
                        fireAndForget(closeTab(nodeId, tabs[0].id as TabId), "close tab");
                      else if (tabs.length > 1)
                        fireAndForget(bulkCloseTabs([nodeId]), "bulk close tabs");
                      setTabs([]);
                      setPendingCloseAllTabs(false);
                    }}
                  >
                    Confirm close?
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setPendingCloseAllTabs(true);
                    }}
                  >
                    {tabs.length === 1 ? "Close tab" : "Close all tabs"}
                  </DropdownMenuItem>
                )}
              </>
            )}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onSelect={() => fireAndForget(togglePin(nodeId), "toggle pin")}>
          {node.data.pinned ? "Unpin" : "Pin"}
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => useStore.getState().openRenameDialog(nodeId)}>
          Rename…
        </DropdownMenuItem>

        {hasChildren && !isCollapsed && (
          <DropdownMenuItem onSelect={() => collapseNodes([nodeId])}>
            Collapse node
          </DropdownMenuItem>
        )}
        {isCollapsed && (
          <DropdownMenuItem onSelect={() => expandNodes([nodeId])}>Expand node</DropdownMenuItem>
        )}

        <DropdownMenuItem
          onSelect={async () => {
            try {
              await navigator.clipboard.writeText(node.data.url);
              toast.success("URL copied");
            } catch (error) {
              showOperationError("Copy URL", error);
            }
          }}
        >
          Copy URL
        </DropdownMenuItem>
        {hasTitle && (
          <DropdownMenuItem
            onSelect={async () => {
              try {
                await navigator.clipboard.writeText(node.data.title || "Untitled");
                toast.success("Title copied");
              } catch (error) {
                showOperationError("Copy title", error);
              }
            }}
          >
            Copy title
          </DropdownMenuItem>
        )}

        {!isRoot && (
          <DropdownMenuItem
            onSelect={() => setPickTarget({ type: "duplicate", sourceNodeId: nodeId })}
          >
            Duplicate at…
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {!isRoot &&
          (pendingDelete === "node" ? (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => fireAndForget(deleteNode(nodeId), "delete node")}
            >
              Confirm delete?
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault();
                setPendingDelete("node");
              }}
            >
              Delete node
            </DropdownMenuItem>
          ))}

        {hasChildren &&
          (pendingDelete === "children" ? (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => fireAndForget(deleteChildren(nodeId), "delete children")}
            >
              Confirm delete?
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault();
                setPendingDelete("children");
              }}
            >
              Delete children
            </DropdownMenuItem>
          ))}

        {pendingDelete === "withChildren" ? (
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              if (isRoot) {
                e.preventDefault();
                openDeleteTreeConfirm(nodeId);
                return;
              }
              fireAndForget(deleteWithChildren(nodeId), "delete subtree");
            }}
          >
            Confirm delete?
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              if (isRoot) {
                e.preventDefault();
                openDeleteTreeConfirm(nodeId);
                return;
              }
              e.preventDefault();
              setPendingDelete("withChildren");
            }}
          >
            {isRoot && !hasChildren ? "Delete tree" : "Delete with children"}
          </DropdownMenuItem>
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
  const openDeleteTreeConfirm = useStore((state) => state.openDeleteTreeConfirm);
  const collapsedNodeIds = useStore((state) => state.graph.collapsedNodeIds);
  const editorActive = useStore((state) => state.editorMode.active);
  const collapseNodes = useStore((state) => state.collapseNodes);
  const expandNodes = useStore((state) => state.expandNodes);
  const [pendingDelete, setPendingDelete] = useState<"nodes" | "recursive" | null>(null);

  useEffect(() => {
    setPendingDelete(null);
  }, [nodeIds, position]);

  const selectedNodes = useMemo(() => {
    if (!tree) return [];
    return nodeIds
      .map((id) => tree.findNodeById(id))
      .filter((node): node is NonNullable<typeof node> => Boolean(node));
  }, [nodeIds, tree]);

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

  return (
    <DropdownMenu
      key={`${position.x}-${position.y}`}
      open
      modal={false}
      onOpenChange={onOpenChange}
    >
      <VirtualTrigger position={position} />
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={0}
        collisionPadding={8}
        className="w-auto min-w-40"
      >
        <DropdownMenuLabel>{nodeIds.length} nodes selected</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            fireAndForget(bulkPin(nodeIds), "bulk pin");
            clearSelection();
          }}
        >
          Pin selected
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            fireAndForget(bulkUnpin(nodeIds), "bulk unpin");
            clearSelection();
          }}
        >
          Unpin selected
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={collapseCandidates.length === 0}
          onSelect={() => {
            if (collapseCandidates.length === 0) return;
            collapseNodes(collapseCandidates.map((node) => node.id));
            clearSelection();
          }}
        >
          Collapse selected
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={expandCandidates.length === 0}
          onSelect={() => {
            if (expandCandidates.length === 0) return;
            expandNodes(expandCandidates.map((node) => node.id));
            clearSelection();
          }}
        >
          Expand selected
        </DropdownMenuItem>

        {!editorActive && (
          <DropdownMenuItem
            onSelect={() => {
              fireAndForget(bulkCloseTabs(nodeIds), "bulk close tabs");
              clearSelection();
            }}
          >
            Close selected tabs
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {pendingDelete === "nodes" ? (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              fireAndForget(bulkDeleteNodes(nodeIds), "bulk delete nodes");
              clearSelection();
            }}
          >
            Confirm delete?
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setPendingDelete("nodes");
            }}
          >
            Delete nodes
          </DropdownMenuItem>
        )}

        {pendingDelete === "recursive" ? (
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              const rootId = getIncludedRootId(tree, nodeIds);
              if (rootId) {
                e.preventDefault();
                openDeleteTreeConfirm(rootId);
                return;
              }
              fireAndForget(bulkDeleteRecursive(nodeIds), "bulk delete recursive");
              clearSelection();
            }}
          >
            Confirm delete?
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setPendingDelete("recursive");
            }}
          >
            Delete nodes recursively
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
