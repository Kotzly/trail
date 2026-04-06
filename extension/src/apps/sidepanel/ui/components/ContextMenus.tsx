import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { NodeId, TabId, Url } from "@shared/types/ids.js";
import { getFaviconUrl } from "@shared/utils/favicon.js";
import { rpc } from "@shared/rpc/contracts.js";
import { cn } from "@ui/lib/utils";
import { fireAndForget } from "../../api/background.js";
import { navigateTo, setCurrentNode } from "../../api/tree.js";
import { getTabsForNodeMessage } from "../../api/tabs.js";
import { useStore } from "../state/store.js";
import { useOverlayEffects } from "../state/overlay-effects.js";
import { Icons } from "./Icon.js";
import { getIncludedRootId } from "../shared/delete-tree.js";
import { getNearestCollapsedAncestorId } from "@features/graph/graph/collapse-utils.js";
import { Button } from "@ui/components/ui/button";
import { Separator } from "@ui/components/ui/separator";

import { toast } from "sonner";
import { browser, type Tab } from "@shared/platform/webext.js";
import { showOperationError } from "../shared/show-operation-error.js";

import React from "react";

type MenuPosition = { left: number; top: number; maxHeight: number };

function useMenuPosition(
  menuRef: RefObject<HTMLDivElement | null>,
  position: { x: number; y: number },
) {
  const [menuStyle, setMenuStyle] = useState<MenuPosition>({
    left: position.x,
    top: position.y,
    maxHeight: window.innerHeight - 16,
  });

  const updatePosition = useCallback(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const padding = 8;
    const availableHeight = Math.max(0, window.innerHeight - padding * 2);
    const clampedHeight = Math.min(menuHeight, availableHeight);
    const maxLeft = window.innerWidth - menuWidth - padding;
    const maxTop = window.innerHeight - padding - clampedHeight;
    const left = Math.min(Math.max(position.x, padding), Math.max(padding, maxLeft));
    const top = Math.min(Math.max(position.y, padding), Math.max(padding, maxTop));
    setMenuStyle({ left, top, maxHeight: availableHeight });
  }, [menuRef, position.x, position.y]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const observer = new ResizeObserver(() => updatePosition());
    observer.observe(menu);
    window.addEventListener("resize", updatePosition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
    };
  }, [menuRef, updatePosition]);

  return menuStyle;
}

// Shared Tailwind classes for menu items
const menuItemBase = "flex items-center px-3 py-2 text-[13px] cursor-pointer rounded-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring";
const menuItemDefault = `${menuItemBase} hover:bg-accent`;
const menuItemDanger = `${menuItemBase} text-destructive hover:bg-destructive/10`;
const menuItemConfirming = `${menuItemBase} text-destructive bg-destructive/10 font-semibold hover:bg-destructive/15`;
const menuItemDisabled = `${menuItemBase} opacity-45 pointer-events-none`;

export default function ContextMenus() {
  const contextMenu = useStore((state) => state.contextMenu);
  const closeContextMenu = useStore((state) => state.closeContextMenu);
  const setHoverNodeId = useStore((state) => state.setHoverNodeId);
  const tree = useStore((state) => state.tree);
  useOverlayEffects(Boolean(contextMenu), { kind: "context" });

  useEffect(() => {
    if (!contextMenu) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if ((target as HTMLElement).closest("[data-context-menu]")) return;
      setHoverNodeId(null);
      closeContextMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHoverNodeId(null);
        closeContextMenu();
      }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeContextMenu, contextMenu, setHoverNodeId]);

  if (!contextMenu) return null;

  if (contextMenu.type === "node") {
    const node = tree?.findNodeById(contextMenu.nodeId);
    if (!node) return null;
    return <NodeContextMenu nodeId={contextMenu.nodeId} position={contextMenu.position} />;
  }

  return <BulkContextMenu nodeIds={contextMenu.nodeIds} position={contextMenu.position} />;
}

type NodeMenuProps = { nodeId: NodeId; position: { x: number; y: number } };

function NodeContextMenu({ nodeId, position }: NodeMenuProps) {
  const closeContextMenu = useStore((state) => state.closeContextMenu);
  const setHoverNodeId = useStore((state) => state.setHoverNodeId);
  const setPickTarget = useStore((state) => state.setPickTarget);
  const tree = useStore((state) => state.tree);
  const openDeleteTreeConfirm = useStore((state) => state.openDeleteTreeConfirm);
  const collapsedNodeIds = useStore((state) => state.graph.collapsedNodeIds);
  const currentNodeId = useStore((state) => state.currentNodeId);
  const editorActive = useStore((state) => state.editorMode.active);
  const collapseNodes = useStore((state) => state.collapseNodes);
  const expandNodes = useStore((state) => state.expandNodes);
  const node = tree?.findNodeById(nodeId);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuStyle = useMenuPosition(menuRef, position);
  const menuVars = { "--menu-max-height": `${menuStyle.maxHeight}px` } as React.CSSProperties;
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [checkedTabId, setCheckedTabId] = useState<number | null>(null);
  const checkTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (checkTimeoutRef.current !== null) {
        window.clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
    };
  }, [nodeId]);

  const updateTabsLayout = useCallback(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const menuHeight = menu.offsetHeight;
    const padding = 8;
    const tabsList = menu.querySelector<HTMLElement>("[data-tabs-list]");
    if (tabsList) {
      const availableHeight = Math.max(0, window.innerHeight - padding * 2);
      const staticHeight = menuHeight - tabsList.offsetHeight;
      const maxTabsHeight = Math.max(96, availableHeight - staticHeight - padding);
      const row = tabsList.querySelector<HTMLElement>("[data-tab-item]");
      const rowHeight = row?.getBoundingClientRect().height ?? 44;
      const gap = 6;
      const listPadding = 6;
      const visibleRows = 5;
      const targetHeight = rowHeight * visibleRows + gap * (visibleRows - 1) + listPadding * 2;
      tabsList.style.maxHeight = `${Math.max(96, Math.min(targetHeight, maxTabsHeight))}px`;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getTabsForNodeMessage(nodeId)
      .then((res) => { if (mounted) setTabs(res); })
      .catch((error) => console.error("Failed to get tabs for node:", error));
    return () => { mounted = false; };
  }, [nodeId]);

  useLayoutEffect(() => { updateTabsLayout(); }, [menuStyle.left, menuStyle.top, updateTabsLayout]);
  useLayoutEffect(() => { updateTabsLayout(); }, [tabs.length, updateTabsLayout]);
  useEffect(() => {
    window.addEventListener("resize", updateTabsLayout);
    return () => window.removeEventListener("resize", updateTabsLayout);
  }, [updateTabsLayout]);

  const [pendingDelete, setPendingDelete] = useState<"node" | "children" | "withChildren" | null>(null);
  const [deletingNode, setDeletingNode] = useState(false);
  const [pendingCloseAllTabs, setPendingCloseAllTabs] = useState(false);
  const hasOpenTab = tabs.length > 0;
  const hasTitle = Boolean(node?.data.title && node.data.title.trim().length > 0);
  const hasChildren = node?.getChildren()?.length ? node.getChildren().length > 0 : false;
  const isRoot = node?.isRoot() ?? false;
  const isCollapsed = collapsedNodeIds.has(nodeId);

  if (!node) return null;

  return (
    <div
      ref={menuRef}
      data-context-menu
      className="fixed z-[1000] min-w-40 max-w-[calc(100vw-16px)] rounded-lg border border-border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95 duration-150"
      role="menu"
      style={{ left: `${menuStyle.left}px`, top: `${menuStyle.top}px`, ...menuVars }}
    >
      <div className="flex flex-col" style={{ maxHeight: "var(--menu-max-height, calc(100vh - 16px))" }}>
        {!editorActive && (
          <>
            <div className={menuItemDefault} role="menuitem" tabIndex={-1}
              onClick={async () => {
                try { await navigateTo(node); closeContextMenu(); }
                catch (error) { showOperationError("Open page", error); }
              }}
            >Open in this tab</div>
            <div className={menuItemDefault} role="menuitem" tabIndex={-1}
              onClick={() => { fireAndForget(rpc.openInNewTab({ nodeId })); closeContextMenu(); }}
            >Open in new tab</div>

            {hasOpenTab && (
              <>
                <Separator className="my-1" />
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide" role="presentation">
                  {tabs.length} open tab{tabs.length !== 1 ? "s" : ""}
                </div>
                <div
                  data-tabs-list
                  className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto overflow-x-hidden p-1.5 min-h-0"
                  onMouseLeave={() => setHoverNodeId(null)}
                >
                  {tabs.map((tab) => (
                    <div
                      key={tab.id}
                      data-tab-item
                      role="menuitem"
                      tabIndex={-1}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors hover:bg-accent"
                      onMouseEnter={() => setHoverNodeId(nodeId)}
                      onMouseLeave={() => setHoverNodeId(null)}
                      onClick={async () => {
                        if (!tab.id) return;
                        setCheckedTabId(tab.id);
                        if (checkTimeoutRef.current !== null) window.clearTimeout(checkTimeoutRef.current);
                        checkTimeoutRef.current = window.setTimeout(() => {
                          setCheckedTabId(null);
                          checkTimeoutRef.current = null;
                        }, 650);
                        try { await browser.tabs.update(tab.id, { active: true }); }
                        catch (error) { console.error("Failed to focus tab:", error); }
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {tab.url && (
                          <img className="size-4 rounded-sm shrink-0" src={getFaviconUrl(tab.url as Url)} alt="" />
                        )}
                        <div className="min-w-0 flex flex-col">
                          <div className="text-xs truncate max-w-[200px]">{tab.title || "Untitled tab"}</div>
                          {tab.url && <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{tab.url}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={cn(
                            "size-5.5 rounded-full inline-flex items-center justify-center bg-muted transition-all",
                            checkedTabId === tab.id ? "opacity-100 scale-100" : "opacity-0 scale-75",
                          )}
                          aria-hidden="true"
                        >
                          <Icons.Check className="size-3.5" />
                        </span>
                        <Button variant="ghost" size="icon-xs" className="rounded-full"
                          aria-label={tab.mutedInfo?.muted ? "Unmute tab" : "Mute tab"}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!tab.id) return;
                            fireAndForget(rpc.toggleMute({ nodeId, tabId: tab.id as TabId }));
                            setTabs((prev) =>
                              prev.map((item) =>
                                item.id === tab.id
                                  ? ({ ...item, mutedInfo: { muted: !item.mutedInfo?.muted, reason: (item.mutedInfo?.reason as "user" | "capture" | "extension" | undefined) ?? undefined } } as typeof item)
                                  : item,
                              ),
                            );
                          }}
                        >
                          {tab.mutedInfo?.muted ? <Icons.VolumeX /> : <Icons.Volume2 />}
                        </Button>
                        <Button variant="ghost" size="icon-xs" className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                          aria-label="Close tab"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!tab.id) return;
                            fireAndForget(rpc.closeTab({ nodeId, tabId: tab.id as TabId }));
                            setTabs((prev) => prev.filter((item) => item.id !== tab.id));
                          }}
                        >
                          <Icons.X />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {pendingCloseAllTabs ? (
                  <div className={menuItemConfirming} role="menuitem" tabIndex={-1}
                    onClick={() => {
                      if (tabs.length === 1 && tabs[0]?.id) fireAndForget(rpc.closeTab({ nodeId, tabId: tabs[0].id as TabId }));
                      else if (tabs.length > 1) fireAndForget(rpc.bulkCloseTabs({ nodeIds: [nodeId] }));
                      setTabs([]); setPendingCloseAllTabs(false); closeContextMenu();
                    }}
                  >Confirm close?</div>
                ) : (
                  <div className={menuItemDefault} role="menuitem" tabIndex={-1}
                    onClick={() => setPendingCloseAllTabs(true)}
                  >{tabs.length === 1 ? "Close tab" : "Close all tabs"}</div>
                )}
              </>
            )}
            <Separator className="my-1" />
          </>
        )}

        <div className={menuItemDefault} role="menuitem" tabIndex={-1}
          onClick={() => { fireAndForget(rpc.togglePin({ nodeId })); closeContextMenu(); }}
        >{node.data.pinned ? "Unpin" : "Pin"}</div>

        {hasChildren && !isCollapsed && (
          <div className={menuItemDefault} role="menuitem" tabIndex={-1}
            onClick={() => {
              const nextCollapsed = new Set(collapsedNodeIds);
              nextCollapsed.add(nodeId);
              const targetId = getNearestCollapsedAncestorId(tree, currentNodeId, nextCollapsed);
              if (targetId && targetId !== currentNodeId) void setCurrentNode(targetId);
              collapseNodes([nodeId]); closeContextMenu();
            }}
          >Collapse node</div>
        )}
        {isCollapsed && (
          <div className={menuItemDefault} role="menuitem" tabIndex={-1}
            onClick={() => { expandNodes([nodeId]); closeContextMenu(); }}
          >Expand node</div>
        )}

        <div className={menuItemDefault} role="menuitem" tabIndex={-1}
          onClick={async () => {
            try { await navigator.clipboard.writeText(node.data.url); toast.success("URL copied"); }
            catch (error) { showOperationError("Copy URL", error); }
            closeContextMenu();
          }}
        >Copy URL</div>
        {hasTitle && (
          <div className={menuItemDefault} role="menuitem" tabIndex={-1}
            onClick={async () => {
              try { await navigator.clipboard.writeText(node.data.title || "Untitled"); toast.success("Title copied"); }
              catch (error) { showOperationError("Copy title", error); }
              closeContextMenu();
            }}
          >Copy title</div>
        )}

        {!isRoot && (
          <div className={menuItemDefault} role="menuitem" tabIndex={-1}
            onClick={() => { setPickTarget({ type: "duplicate", sourceNodeId: nodeId }); closeContextMenu(); }}
          >Duplicate at…</div>
        )}

        <Separator className="my-1" />

        {!isRoot && (pendingDelete === "node" ? (
          <div className={menuItemConfirming} role="menuitem" tabIndex={-1}
            onClick={() => { if (deletingNode) return; setDeletingNode(true); fireAndForget(rpc.deleteNode({ nodeId })); closeContextMenu(); }}
          >Confirm delete?</div>
        ) : (
          <div className={menuItemDanger} role="menuitem" tabIndex={-1}
            onClick={() => setPendingDelete("node")}
          >Delete node</div>
        ))}

        {hasChildren && (pendingDelete === "children" ? (
          <div className={menuItemConfirming} role="menuitem" tabIndex={-1}
            onClick={() => { fireAndForget(rpc.deleteChildren({ nodeId })); closeContextMenu(); }}
          >Confirm delete?</div>
        ) : (
          <div className={menuItemDanger} role="menuitem" tabIndex={-1}
            onClick={() => setPendingDelete("children")}
          >Delete children</div>
        ))}

        {pendingDelete === "withChildren" ? (
          <div className={menuItemConfirming} role="menuitem" tabIndex={-1}
            onClick={() => {
              if (isRoot) { openDeleteTreeConfirm(nodeId); return; }
              fireAndForget(rpc.deleteWithChildren({ nodeId })); closeContextMenu();
            }}
          >Confirm delete?</div>
        ) : (
          <div className={menuItemDanger} role="menuitem" tabIndex={-1}
            onClick={() => {
              if (isRoot) { openDeleteTreeConfirm(nodeId); return; }
              setPendingDelete("withChildren");
            }}
          >{isRoot && !hasChildren ? "Delete tree" : "Delete with children"}</div>
        )}
      </div>
    </div>
  );
}

type BulkMenuProps = { nodeIds: NodeId[]; position: { x: number; y: number } };

function BulkContextMenu({ nodeIds, position }: BulkMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuStyle = useMenuPosition(menuRef, position);
  const menuVars = { "--menu-max-height": `${menuStyle.maxHeight}px` } as React.CSSProperties;
  const closeContextMenu = useStore((state) => state.closeContextMenu);
  const clearSelection = useStore((state) => state.clearSelection);
  const tree = useStore((state) => state.tree);
  const openDeleteTreeConfirm = useStore((state) => state.openDeleteTreeConfirm);
  const collapsedNodeIds = useStore((state) => state.graph.collapsedNodeIds);
  const currentNodeId = useStore((state) => state.currentNodeId);
  const editorActive = useStore((state) => state.editorMode.active);
  const collapseNodes = useStore((state) => state.collapseNodes);
  const expandNodes = useStore((state) => state.expandNodes);
  const [pendingDelete, setPendingDelete] = useState<"nodes" | "recursive" | null>(null);
  const [deletingBulk, setDeletingBulk] = useState(false);

  useEffect(() => { setPendingDelete(null); }, [nodeIds, position]);

  const selectedNodes = useMemo(() => {
    if (!tree) return [];
    return nodeIds.map((id) => tree.findNodeById(id)).filter((node): node is NonNullable<typeof node> => Boolean(node));
  }, [nodeIds, tree]);

  const collapseCandidates = useMemo(
    () => selectedNodes.filter((node) => (node.getChildren?.() ?? []).length > 0 && !collapsedNodeIds.has(node.id)),
    [collapsedNodeIds, selectedNodes],
  );
  const expandCandidates = useMemo(
    () => selectedNodes.filter((node) => collapsedNodeIds.has(node.id)),
    [collapsedNodeIds, selectedNodes],
  );

  return (
    <div
      ref={menuRef}
      data-context-menu
      className="fixed z-[1000] min-w-40 max-w-[calc(100vw-16px)] rounded-lg border border-border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95 duration-150"
      role="menu"
      style={{ left: `${menuStyle.left}px`, top: `${menuStyle.top}px`, ...menuVars }}
    >
      <div className="flex flex-col" style={{ maxHeight: "var(--menu-max-height, calc(100vh - 16px))" }}>
        <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide" role="presentation">
          {nodeIds.length} nodes selected
        </div>
        <Separator className="my-1" />

        <div className={menuItemDefault} role="menuitem" tabIndex={-1}
          onClick={() => { fireAndForget(rpc.bulkPin({ nodeIds })); clearSelection(); closeContextMenu(); }}
        >Pin selected</div>
        <div className={menuItemDefault} role="menuitem" tabIndex={-1}
          onClick={() => { fireAndForget(rpc.bulkUnpin({ nodeIds })); clearSelection(); closeContextMenu(); }}
        >Unpin selected</div>

        <div className={collapseCandidates.length === 0 ? menuItemDisabled : menuItemDefault} role="menuitem" tabIndex={-1}
          aria-disabled={collapseCandidates.length === 0}
          onClick={() => {
            if (collapseCandidates.length === 0) return;
            const nextCollapsed = new Set(collapsedNodeIds);
            collapseCandidates.forEach((node) => nextCollapsed.add(node.id));
            const targetId = getNearestCollapsedAncestorId(tree, currentNodeId, nextCollapsed);
            if (targetId && targetId !== currentNodeId) void setCurrentNode(targetId);
            collapseNodes(collapseCandidates.map((node) => node.id));
            clearSelection(); closeContextMenu();
          }}
        >Collapse selected</div>

        <div className={expandCandidates.length === 0 ? menuItemDisabled : menuItemDefault} role="menuitem" tabIndex={-1}
          aria-disabled={expandCandidates.length === 0}
          onClick={() => {
            if (expandCandidates.length === 0) return;
            expandNodes(expandCandidates.map((node) => node.id));
            clearSelection(); closeContextMenu();
          }}
        >Expand selected</div>

        {!editorActive && (
          <div className={menuItemDefault} role="menuitem" tabIndex={-1}
            onClick={() => { fireAndForget(rpc.bulkCloseTabs({ nodeIds })); clearSelection(); closeContextMenu(); }}
          >Close selected tabs</div>
        )}

        <Separator className="my-1" />

        {pendingDelete === "nodes" ? (
          <div className={menuItemConfirming} role="menuitem" tabIndex={-1}
            onClick={() => {
              if (deletingBulk) return; setDeletingBulk(true);
              fireAndForget(rpc.bulkDeleteNodes({ nodeIds })); clearSelection(); closeContextMenu();
            }}
          >Confirm delete?</div>
        ) : (
          <div className={menuItemDanger} role="menuitem" tabIndex={-1}
            onClick={() => setPendingDelete("nodes")}
          >Delete nodes</div>
        )}

        {pendingDelete === "recursive" ? (
          <div className={menuItemConfirming} role="menuitem" tabIndex={-1}
            onClick={() => {
              if (deletingBulk) return; setDeletingBulk(true);
              const rootId = getIncludedRootId(tree, nodeIds);
              if (rootId) { openDeleteTreeConfirm(rootId); return; }
              fireAndForget(rpc.bulkDeleteRecursive({ nodeIds })); clearSelection(); closeContextMenu();
            }}
          >Confirm delete?</div>
        ) : (
          <div className={menuItemDanger} role="menuitem" tabIndex={-1}
            onClick={() => setPendingDelete("recursive")}
          >Delete nodes recursively</div>
        )}
      </div>
    </div>
  );
}
