import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClipboard } from "@ui/hooks/use-clipboard";
import type { NodeId, TabId, Url } from "@shared/types/ids.js";
import { getFaviconUrl } from "@shared/utils/favicon.js";
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

function MenuShortcut({ keys }: { keys: readonly ShortcutKey[] }) {
  return (
    <Shortcut
      keys={keys}
      className="ml-auto pl-3 [&_kbd]:h-6 [&_kbd]:min-w-6 [&_kbd]:px-1.5 [&_kbd]:text-sm [&_kbd]:uppercase"
    />
  );
}

type DestructiveItemProps = {
  label: string;
  confirmLabel: string;
  pending: boolean;
  onArm: () => void;
  onConfirm: () => void;
  icon?: React.ReactNode;
  shortcut?: readonly ShortcutKey[];
};

/**
 * Two-step destructive menu item. Shift-click (or Shift+Space/Enter) skips
 * the confirmation step for power users.
 */
function DestructiveItem({
  label,
  confirmLabel,
  pending,
  onArm,
  onConfirm,
  icon,
  shortcut,
}: DestructiveItemProps) {
  const shiftRef = useRef(false);

  if (pending) {
    return (
      <DropdownMenuItem variant="destructive" onSelect={() => onConfirm()}>
        <Icons.Trash2 />
        {confirmLabel}
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      variant="destructive"
      onPointerDown={(event) => {
        shiftRef.current = event.shiftKey;
      }}
      onKeyDown={(event) => {
        shiftRef.current = event.shiftKey;
      }}
      onSelect={(event) => {
        if (shiftRef.current) {
          onConfirm();
          return;
        }
        event.preventDefault();
        onArm();
      }}
    >
      {icon ?? <Icons.Trash2 />}
      {label}
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
          className="size-4 shrink-0 rounded-sm"
          src={getFaviconUrl(tab.url as Url)}
          alt=""
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
      )}
      <div className="flex w-48 flex-col">
        <span className="truncate text-xs">{tab.title || "Untitled tab"}</span>
        {displayUrl && (
          <span className="text-muted-foreground truncate text-[10px]">{displayUrl}</span>
        )}
      </div>
      <ButtonGroup>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={muted ? "Unmute tab" : "Mute tab"}
          onClick={(e) => {
            e.stopPropagation();
            onMute();
          }}
        >
          {muted ? <Icons.VolumeX /> : <Icons.Volume2 />}
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          aria-label="Close tab"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
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
  const setPickTarget = useStore((state) => state.setPickTarget);
  const tree = useStore((state) => state.tree);
  const openDeleteTreeConfirm = useStore((state) => state.openDeleteTreeConfirm);
  const collapsedNodeIds = useStore((state) => state.graph.collapsedNodeIds);
  const editorActive = useStore((state) => state.editorMode.active);
  const collapseNodes = useStore((state) => state.collapseNodes);
  const expandNodes = useStore((state) => state.expandNodes);
  const node = tree?.findNodeById(nodeId);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [pendingDelete, setPendingDelete] = useState<"node" | "children" | "subtree" | null>(null);
  const [pendingCloseAllTabs, setPendingCloseAllTabs] = useState(false);
  const closeAllShiftRef = useRef(false);
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

  if (!node) return null;

  const hasOpenTab = tabs.length > 0;
  const hasTitle = Boolean(node.data.title && node.data.title.trim().length > 0);
  const hasChildren = (node.getChildren?.() ?? []).length > 0;
  const isRoot = node.isRoot();
  const isCollapsed = collapsedNodeIds.has(nodeId);

  const confirmCloseAllTabs = () => {
    fireAndForget(bulkCloseTabs([nodeId]), "bulk close tabs");
    setTabs([]);
    setPendingCloseAllTabs(false);
  };

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
        className="**:data-[slot$=-item]:hover:bg-foreground/10 **:data-[slot$=-trigger]:hover:bg-foreground/10 w-auto min-w-48"
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
              <Icons.ArrowRight />
              Open in this tab
              <MenuShortcut keys={["enter"]} />
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => fireAndForget(openInNewTab(nodeId), "open in new tab")}
            >
              <Icons.ExternalLink />
              Open in new tab
              <MenuShortcut keys={["meta", "enter"]} />
            </DropdownMenuItem>

            {hasOpenTab && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>
                  {tabs.length} open tab{tabs.length !== 1 ? "s" : ""}
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
                {tabs.length > 1 &&
                  (pendingCloseAllTabs ? (
                    <DropdownMenuItem variant="destructive" onSelect={confirmCloseAllTabs}>
                      <Icons.X />
                      Confirm: close all tabs
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      variant="destructive"
                      onPointerDown={(event) => {
                        closeAllShiftRef.current = event.shiftKey;
                      }}
                      onKeyDown={(event) => {
                        closeAllShiftRef.current = event.shiftKey;
                      }}
                      onSelect={(event) => {
                        if (closeAllShiftRef.current) {
                          confirmCloseAllTabs();
                          return;
                        }
                        event.preventDefault();
                        setPendingCloseAllTabs(true);
                      }}
                    >
                      <Icons.X />
                      Close all tabs
                    </DropdownMenuItem>
                  ))}
              </>
            )}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onSelect={() => fireAndForget(togglePin(nodeId), "toggle pin")}>
          {node.data.pinned ? <Icons.PinOff /> : <Icons.Pin />}
          {node.data.pinned ? "Unpin" : "Pin"}
          <MenuShortcut keys={["p"]} />
        </DropdownMenuItem>

        {hasChildren && !isCollapsed && (
          <DropdownMenuItem onSelect={() => collapseNodes([nodeId])}>
            <Icons.FoldVertical />
            Collapse node
          </DropdownMenuItem>
        )}
        {isCollapsed && (
          <DropdownMenuItem onSelect={() => expandNodes([nodeId])}>
            <Icons.UnfoldVertical />
            Expand node
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onSelect={() => useStore.getState().openRenameDialog(nodeId)}>
          <Icons.Pencil />
          Rename…
          <MenuShortcut keys={["F2"]} />
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={async () => {
            await copyToClipboard(node.data.url);
            toast.success("URL copied");
          }}
        >
          <Icons.Link />
          Copy URL
        </DropdownMenuItem>
        {hasTitle && (
          <DropdownMenuItem
            onSelect={async () => {
              await copyToClipboard(node.data.title || "Untitled");
              toast.success("Title copied");
            }}
          >
            <Icons.Type />
            Copy title
          </DropdownMenuItem>
        )}

        {!isRoot && (
          <DropdownMenuItem
            onSelect={() => setPickTarget({ type: "duplicate", sourceNodeId: nodeId })}
          >
            <Icons.Copy />
            Duplicate at…
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {isRoot ? (
          <DestructiveItem
            label="Delete tree"
            confirmLabel="Confirm: delete tree"
            pending={pendingDelete === "subtree"}
            onArm={() => openDeleteTreeConfirm(nodeId)}
            onConfirm={() => openDeleteTreeConfirm(nodeId)}
          />
        ) : (
          <>
            <DestructiveItem
              label="Delete node"
              confirmLabel="Confirm: delete node"
              pending={pendingDelete === "node"}
              onArm={() => setPendingDelete("node")}
              onConfirm={() => fireAndForget(deleteNode(nodeId), "delete node")}
              shortcut={["delete"]}
            />
            {hasChildren && (
              <>
                <DestructiveItem
                  label="Delete children"
                  confirmLabel="Confirm: delete children"
                  pending={pendingDelete === "children"}
                  onArm={() => setPendingDelete("children")}
                  onConfirm={() => fireAndForget(deleteChildren(nodeId), "delete children")}
                />
                <DestructiveItem
                  label="Delete subtree"
                  confirmLabel="Confirm: delete subtree"
                  pending={pendingDelete === "subtree"}
                  onArm={() => setPendingDelete("subtree")}
                  onConfirm={() => fireAndForget(deleteWithChildren(nodeId), "delete subtree")}
                  shortcut={["shift", "delete"]}
                />
              </>
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
  const openDeleteTreeConfirm = useStore((state) => state.openDeleteTreeConfirm);
  const collapsedNodeIds = useStore((state) => state.graph.collapsedNodeIds);
  const editorActive = useStore((state) => state.editorMode.active);
  const collapseNodes = useStore((state) => state.collapseNodes);
  const expandNodes = useStore((state) => state.expandNodes);
  const [pendingDelete, setPendingDelete] = useState<"nodes" | "recursive" | null>(null);
  const { copy: copyToClipboard } = useClipboard();

  useEffect(() => {
    setPendingDelete(null);
  }, [nodeIds, position]);

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

  const confirmDeleteNodes = () => {
    fireAndForget(bulkDeleteNodes(nodeIds), "bulk delete nodes");
    clearSelection();
  };

  const confirmDeleteRecursive = () => {
    const rootId = getIncludedRootId(tree, nodeIds);
    if (rootId) {
      openDeleteTreeConfirm(rootId);
      return;
    }
    fireAndForget(bulkDeleteRecursive(nodeIds), "bulk delete recursive");
    clearSelection();
  };

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
        className="**:data-[slot$=-item]:hover:bg-foreground/10 **:data-[slot$=-trigger]:hover:bg-foreground/10 w-auto max-w-60 min-w-48"
      >
        <DropdownMenuLabel>{nodeIds.length} nodes selected</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            fireAndForget(allPinned ? bulkUnpin(nodeIds) : bulkPin(nodeIds), "bulk pin toggle");
            clearSelection();
          }}
        >
          {allPinned ? <Icons.PinOff /> : <Icons.Pin />}
          {allPinned ? "Unpin selected" : "Pin selected"}
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
          <Icons.UnfoldVertical />
          Expand selected
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={async () => {
            const urls = selectedNodes.map((node) => node.data.url).filter(Boolean);
            if (urls.length === 0) return;
            await copyToClipboard(urls.join("\n"));
            toast.success(`${urls.length} URL${urls.length !== 1 ? "s" : ""} copied`);
          }}
        >
          <Icons.Link />
          Copy URLs
        </DropdownMenuItem>

        {!editorActive && (
          <DropdownMenuItem
            onSelect={() => {
              fireAndForget(bulkCloseTabs(nodeIds), "bulk close tabs");
              clearSelection();
            }}
          >
            <Icons.X />
            Close selected tabs
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DestructiveItem
          label="Delete nodes"
          confirmLabel="Confirm: delete nodes"
          pending={pendingDelete === "nodes"}
          onArm={() => setPendingDelete("nodes")}
          onConfirm={confirmDeleteNodes}
          shortcut={["delete"]}
        />
        <DestructiveItem
          label="Delete subtrees"
          confirmLabel="Confirm: delete subtrees"
          pending={pendingDelete === "recursive"}
          onArm={() => setPendingDelete("recursive")}
          onConfirm={confirmDeleteRecursive}
          shortcut={["shift", "delete"]}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
