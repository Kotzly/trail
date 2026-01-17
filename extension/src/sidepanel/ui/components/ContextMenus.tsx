import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { NodeId, TabId, Tag } from '../../../shared/types/ids.js';
import type { TagDefinition } from '../../../shared/types/tags.js';
import { msg } from '../../../shared/types/messages.js';
import { fireAndForget } from '../../api/background.js';
import {
  beginTempSelection,
  cancelTempSelection,
  endTempSelection,
  navigateTo,
  previewTempSelection,
} from '../../api/tree.js';
import { getTabsForNodeMessage } from '../../api/tabs.js';
import { useStore } from '../state/store.js';
import TagEditorModal from './tags/TagEditorModal.js';
import { deleteTagDef, upsertTagDef } from '../../api/tags.js';
import { Icons } from './Icon.js';
import React from 'react';

type MenuPosition = { left: number; top: number; maxHeight: number };

const SUBMENU_MIN_WIDTH = 160;

function useMenuPosition(menuRef: RefObject<HTMLDivElement>, position: { x: number; y: number }) {
  const [menuStyle, setMenuStyle] = useState<MenuPosition>({
    left: position.x,
    top: position.y,
    maxHeight: window.innerHeight - 16,
  });

  const updatePosition = useCallback(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
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
    window.addEventListener('resize', updatePosition);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
    };
  }, [menuRef, updatePosition]);

  return menuStyle;
}

export default function ContextMenus() {
  const contextMenu = useStore((state) => state.contextMenu);
  const closeContextMenu = useStore((state) => state.closeContextMenu);
  const setHoverNodeId = useStore((state) => state.setHoverNodeId);
  const tree = useStore((state) => state.tree);
  const [tagEditorState, setTagEditorState] = useState<{
    open: boolean;
    nodeId: NodeId | null;
    mode: 'create' | 'edit';
    initial?: TagDefinition | null;
  }>({ open: false, nodeId: null, mode: 'create', initial: null });

  useEffect(() => {
    if (!contextMenu) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if ((target as HTMLElement).closest('.graph-context-menu')) return;
      setHoverNodeId(null);
      closeContextMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHoverNodeId(null);
        closeContextMenu();
      }
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeContextMenu, contextMenu]);

  const tagEditorModal = tagEditorState.open ? (
    <TagEditorModal
      open={tagEditorState.open}
      mode={tagEditorState.mode}
      initial={tagEditorState.initial}
      onCancel={() => setTagEditorState({ open: false, nodeId: null, mode: 'create', initial: null })}
      onSubmit={async (value) => {
        try {
          if (tagEditorState.mode === 'edit' && tagEditorState.initial) {
            const updated: TagDefinition = {
              ...tagEditorState.initial,
              label: value.label,
              color: value.color,
              iconId: value.iconId,
              updatedAt: Date.now(),
            };
            await upsertTagDef(updated);
          } else {
            if (!tagEditorState.nodeId) {
              setTagEditorState({ open: false, nodeId: null, mode: 'create', initial: null });
              return;
            }
            const id = `custom-${Date.now().toString(36)}-${Math.random()
              .toString(36)
              .slice(2, 6)}` as Tag;
            const tagDef: TagDefinition = {
              id,
              label: value.label,
              color: value.color,
              iconId: value.iconId,
              system: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            await upsertTagDef(tagDef);
            fireAndForget(msg.addTag({ nodeId: tagEditorState.nodeId, tagId: id }));
          }
        } catch (error) {
          console.error('Failed to save tag:', error);
        } finally {
          setTagEditorState({ open: false, nodeId: null, mode: 'create', initial: null });
        }
      }}
    />
  ) : null;

  if (!contextMenu) {
    return tagEditorModal;
  }

  if (contextMenu.type === 'node') {
    const node = tree?.findNodeById(contextMenu.nodeId);
    if (!node) return null;
    return (
      <>
        <NodeContextMenu
          nodeId={contextMenu.nodeId}
          position={contextMenu.position}
          onCreateTag={() => {
            setTagEditorState({
              open: true,
              nodeId: contextMenu.nodeId,
              mode: 'create',
              initial: null,
            });
            closeContextMenu();
          }}
          onEditTag={(tag) => {
            setTagEditorState({
              open: true,
              nodeId: null,
              mode: 'edit',
              initial: tag,
            });
            closeContextMenu();
          }}
        />
        {tagEditorModal}
      </>
    );
  }

  return (
    <>
      <BulkContextMenu nodeIds={contextMenu.nodeIds} position={contextMenu.position} />
      {tagEditorModal}
    </>
  );
}

type NodeMenuProps = {
  nodeId: NodeId;
  position: { x: number; y: number };
  onCreateTag: () => void;
  onEditTag: (tag: TagDefinition) => void;
};

function NodeContextMenu({ nodeId, position, onCreateTag, onEditTag }: NodeMenuProps) {
  const closeContextMenu = useStore((state) => state.closeContextMenu);
  const setHoverNodeId = useStore((state) => state.setHoverNodeId);
  const tree = useStore((state) => state.tree);
  const tagDefsList = useStore((state) => state.tagDefsList);
  const currentNodeId = useStore((state) => state.currentNodeId);
  const searchActive = useStore((state) => state.search.active);
  const node = tree?.findNodeById(nodeId);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuStyle = useMenuPosition(menuRef, position);
  const [submenuLeft, setSubmenuLeft] = useState(false);
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [checkedTabId, setCheckedTabId] = useState<number | null>(null);
  const checkTimeoutRef = useRef<number | null>(null);
  const tempSessionRef = useRef<string | null>(null);
  const tempSessionPromiseRef = useRef<Promise<string | null> | null>(null);
  const sessionStatusRef = useRef<'idle' | 'active' | 'ended'>('idle');
  const cancelQueuedRef = useRef<null | 'keep'>(null);
  const lastPreviewTabRef = useRef<number | null>(null);
  const committedRef = useRef(false);

  const ensureTempSession = useCallback(async () => {
    if (searchActive) return null;
    if (sessionStatusRef.current === 'ended') return null;
    if (tempSessionRef.current) return tempSessionRef.current;
    if (tempSessionPromiseRef.current) return tempSessionPromiseRef.current;
    sessionStatusRef.current = 'active';
    tempSessionPromiseRef.current = beginTempSelection({
      baseNodeId: currentNodeId ?? null,
      options: {
        allowCreateOnCommit: false,
        allowPreviewWithoutTabs: false,
      },
    })
      .then((result) => {
        if (sessionStatusRef.current !== 'active') {
          endTempSelection(result.sessionId).catch((error) =>
            console.error('Failed to end temp selection:', error),
          );
          return null;
        }
        tempSessionRef.current = result.sessionId;
        if (cancelQueuedRef.current) {
          cancelQueuedRef.current = null;
          cancelTempSelection(result.sessionId, { keepSession: true }).catch((error) =>
            console.error('Failed to cancel temp selection:', error),
          );
        }
        return result.sessionId;
      })
      .catch((error) => {
        console.error('Failed to begin temp selection:', error);
        return null;
      })
      .finally(() => {
        tempSessionPromiseRef.current = null;
      });
    return tempSessionPromiseRef.current;
  }, [currentNodeId, searchActive]);

  const cancelTempSessionPreview = useCallback(() => {
    if (committedRef.current) return;
    if (sessionStatusRef.current !== 'active') return;
    const sessionId = tempSessionRef.current;
    if (sessionId) {
      cancelTempSelection(sessionId, { keepSession: true }).catch((error) =>
        console.error('Failed to cancel temp selection:', error),
      );
      lastPreviewTabRef.current = null;
      return;
    }
    if (tempSessionPromiseRef.current) {
      cancelQueuedRef.current = 'keep';
    }
    lastPreviewTabRef.current = null;
  }, []);

  const finalizeTempSession = useCallback(
    (commit: boolean) => {
      if (sessionStatusRef.current === 'ended') return;
      sessionStatusRef.current = 'ended';
      cancelQueuedRef.current = null;
      const sessionId = tempSessionRef.current;
      if (sessionId) {
        if (!commit) {
          cancelTempSelection(sessionId).catch((error) =>
            console.error('Failed to cancel temp selection:', error),
          );
        }
        endTempSelection(sessionId).catch((error) =>
          console.error('Failed to end temp selection:', error),
        );
        tempSessionRef.current = null;
        lastPreviewTabRef.current = null;
      }

      if (tempSessionPromiseRef.current) {
        tempSessionPromiseRef.current
          .then((id) => {
            if (!id) return;
            if (!commit) {
              cancelTempSelection(id).catch((error) =>
                console.error('Failed to cancel temp selection:', error),
              );
            }
            endTempSelection(id).catch((error) =>
              console.error('Failed to end temp selection:', error),
            );
          })
          .catch(() => undefined);
        tempSessionPromiseRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    committedRef.current = false;
    sessionStatusRef.current = 'idle';
    cancelQueuedRef.current = null;
    lastPreviewTabRef.current = null;
    return () => {
      if (checkTimeoutRef.current !== null) {
        window.clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
      finalizeTempSession(committedRef.current);
    };
  }, [finalizeTempSession, nodeId]);

  const updateSubmenuLayout = useCallback(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const menuHeight = menu.offsetHeight;
    const padding = 8;
    const spaceRight = Math.max(0, window.innerWidth - rect.right - padding);
    const spaceLeft = Math.max(0, rect.left - padding);
    const shouldFlip = spaceRight < SUBMENU_MIN_WIDTH && spaceLeft > spaceRight;
    setSubmenuLeft(shouldFlip);
    const availableWidth = shouldFlip ? spaceLeft : spaceRight;

    const items = menu.querySelectorAll<HTMLElement>('.graph-context-menu-item.has-submenu');
    items.forEach((item) => {
      const submenu = item.querySelector<HTMLElement>('.graph-context-submenu');
      if (!submenu) return;
      submenu.style.setProperty('--submenu-offset-y', '0px');
      submenu.style.maxWidth = `${availableWidth}px`;
      submenu.style.minWidth = `${Math.min(SUBMENU_MIN_WIDTH, availableWidth)}px`;
      const submenuRect = submenu.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const maxBottom = window.innerHeight - padding;
      const maxTop = padding;
      const overflowBottom = itemRect.top + submenuRect.height - maxBottom;
      if (overflowBottom > 0) {
        const maxShift = Math.max(0, itemRect.top - maxTop);
        const shift = Math.min(overflowBottom, maxShift);
        submenu.style.setProperty('--submenu-offset-y', `${-shift}px`);
      } else if (itemRect.top < maxTop) {
        const shiftDown = maxTop - itemRect.top;
        submenu.style.setProperty('--submenu-offset-y', `${shiftDown}px`);
      }
    });

    const tabsList = menu.querySelector<HTMLElement>('.graph-context-tabs');
    if (tabsList) {
      const availableHeight = Math.max(0, window.innerHeight - padding * 2);
      const staticHeight = menuHeight - tabsList.offsetHeight;
      const maxTabsHeight = Math.max(96, availableHeight - staticHeight - padding);
      const row = tabsList.querySelector<HTMLElement>('.graph-context-tab-item');
      const rowHeight = row?.getBoundingClientRect().height ?? 44;
      const gap = 6;
      const listPadding = 6;
      const visibleRows = 5;
      const targetHeight =
        rowHeight * visibleRows + gap * (visibleRows - 1) + listPadding * 2;
      tabsList.style.maxHeight = `${Math.max(96, Math.min(targetHeight, maxTabsHeight))}px`;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getTabsForNodeMessage(nodeId)
      .then((res) => {
        if (mounted) setTabs(res);
      })
      .catch((error) => console.error('Failed to get tabs for node:', error));
    return () => {
      mounted = false;
    };
  }, [nodeId]);

  useLayoutEffect(() => {
    updateSubmenuLayout();
  }, [menuStyle.left, menuStyle.top, updateSubmenuLayout]);

  useLayoutEffect(() => {
    updateSubmenuLayout();
  }, [tabs.length, updateSubmenuLayout]);

  useEffect(() => {
    window.addEventListener('resize', updateSubmenuLayout);
    return () => window.removeEventListener('resize', updateSubmenuLayout);
  }, [updateSubmenuLayout]);

  const handleTabHover = useCallback(
    async (tabId?: TabId) => {
      if (!tabId) return;
      if (sessionStatusRef.current !== 'active' && sessionStatusRef.current !== 'idle') return;
      if (lastPreviewTabRef.current === tabId) return;
      const sessionId = await ensureTempSession();
      if (!sessionId) return;
      if (sessionStatusRef.current !== 'active') return;
      lastPreviewTabRef.current = tabId;
      previewTempSelection(sessionId, nodeId, tabId).catch((error) => {
        if (sessionStatusRef.current !== 'active') return;
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Temp selection session not found')) return;
        console.error('Failed to preview tab:', error);
      });
    },
    [ensureTempSession, nodeId],
  );

  const hasOpenTab = tabs.length > 0;
  const hasTitle = Boolean(node?.data.title && node.data.title.trim().length > 0);
  const hasChildren = node?.getChildren()?.length ? node.getChildren().length > 0 : false;
  const isRoot = node?.isRoot() ?? false;

  if (!node) return null;

  return (
    <>
      <div
        ref={menuRef}
        className={`graph-context-menu${submenuLeft ? ' submenu-left' : ''}`}
        style={{
          left: `${menuStyle.left}px`,
          top: `${menuStyle.top}px`,
          // @ts-ignore -- Allow custom CSS prop for menu max height
          ['--menu-max-height']: `${menuStyle.maxHeight}px`,
        }}
      >
        <div className="graph-context-menu-content">
          <div
            className="graph-context-menu-item"
            onClick={() => {
              void navigateTo(node);
              closeContextMenu();
            }}
          >
            Open in this tab
          </div>
          <div
            className="graph-context-menu-item"
            onClick={() => {
              fireAndForget(msg.openInNewTab({ nodeId }));
              closeContextMenu();
            }}
          >
            Open in new tab
          </div>

      {hasOpenTab && (
        <>
          <div className="graph-context-menu-divider" />
          <div className="graph-context-menu-header">
            {tabs.length} open tab{tabs.length !== 1 ? "s" : ""}
          </div>
          <div
            className="graph-context-tabs"
            onMouseLeave={() => {
              cancelTempSessionPreview();
              setHoverNodeId(null);
            }}
          >
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`graph-context-tab-item${checkedTabId === tab.id ? ' is-checked' : ''}`}
                onMouseEnter={() => {
                  setHoverNodeId(nodeId);
                  void handleTabHover(tab.id as TabId);
                }}
                onMouseLeave={() => setHoverNodeId(null)}
                onClick={async () => {
                  committedRef.current = true;
                  finalizeTempSession(true);
                  if (!tab.id) return;
                  setCheckedTabId(tab.id);
                  if (checkTimeoutRef.current !== null) {
                    window.clearTimeout(checkTimeoutRef.current);
                  }
                  checkTimeoutRef.current = window.setTimeout(() => {
                    setCheckedTabId(null);
                    checkTimeoutRef.current = null;
                  }, 650);
                  try {
                    await chrome.tabs.update(tab.id, { active: true });
                  } catch (error) {
                    console.error('Failed to focus tab:', error);
                  }
                }}
              >
                <div className="graph-context-tab-info">
                  {tab.favIconUrl ? (
                    <img className="graph-context-tab-favicon" src={tab.favIconUrl} alt="" />
                  ) : (
                    <span className="graph-context-tab-favicon placeholder">🌐</span>
                  )}
                  <div className="graph-context-tab-text">
                    <div className="graph-context-tab-title">{tab.title || 'Untitled tab'}</div>
                    {tab.url ? (
                      <div className="graph-context-tab-url">{tab.url}</div>
                    ) : null}
                  </div>
                </div>
                <div className="graph-context-tab-actions">
                  <span className="graph-context-tab-check" aria-hidden="true">
                    <Icons.Check size={14} />
                  </span>
                  <button
                    type="button"
                    className="graph-context-tab-action"
                    aria-label={tab.mutedInfo?.muted ? 'Unmute tab' : 'Mute tab'}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!tab.id) return;
                      fireAndForget(
                        msg.toggleMute({ nodeId, tabId: tab.id as TabId }),
                      );
                      setTabs((prev) =>
                        prev.map((item) =>
                          item.id === tab.id
                            ? {
                                ...item,
                                mutedInfo: {
                                  muted: !item.mutedInfo?.muted,
                                  reason: (item.mutedInfo?.reason as "user" | "capture" | "extension" | undefined) ?? undefined,
                                },
                              } as typeof item
                            : item,
                        )
                      );
                    }}
                  >
                    {tab.mutedInfo?.muted ? <Icons.VolumeX size={14} /> : <Icons.Volume2 size={14} />}
                  </button>
                  <button
                    type="button"
                    className="graph-context-tab-action danger"
                    aria-label="Close tab"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!tab.id) return;
                      fireAndForget(msg.closeTab({ nodeId, tabId: tab.id as TabId }));
                      setTabs((prev) => prev.filter((item) => item.id !== tab.id));
                    }}
                  >
                    <Icons.X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div
            className="graph-context-menu-item"
            onClick={() => {
              if (tabs.length === 1 && tabs[0]?.id) {
                fireAndForget(msg.closeTab({ nodeId, tabId: tabs[0].id as TabId }));
                setTabs([]);
              } else if (tabs.length > 1) {
                fireAndForget(msg.bulkCloseTabs({ nodeIds: [nodeId] }));
                setTabs([]);
              }
            }}
          >
            {tabs.length === 1 ? 'Close tab' : 'Close all tabs'}
          </div>
        </>
      )}

      <div className="graph-context-menu-divider" />
      <div
        className="graph-context-menu-item"
        onClick={() => {
          fireAndForget(msg.togglePin({ nodeId }));
          closeContextMenu();
        }}
      >
        {node.data.pinned ? 'Unpin' : 'Pin'}
      </div>

      <div className="graph-context-menu-item has-submenu">
        Tags <span className="submenu-arrow">›</span>
        <div className="graph-context-submenu">
          {tagDefsList.map((tag) => {
            const hasTag = node.data.tags?.includes(tag.id as Tag);
            return (
              <div
                key={tag.id as string}
                className="graph-context-menu-item tag-option"
                onClick={(event) => {
                  event.stopPropagation();
                  if (hasTag) {
                    fireAndForget(msg.removeTag({ nodeId, tagId: tag.id as Tag }));
                  } else {
                    fireAndForget(msg.addTag({ nodeId, tagId: tag.id as Tag }));
                  }
                  closeContextMenu();
                }}
              >
                <span className="tag-pill" style={{ '--tag-color': tag.color } as React.CSSProperties}>
                  {tag.label}
                </span>
                <span className="tag-actions">
                  <button
                    type="button"
                    className="tag-action-btn"
                    aria-label="Edit tag"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEditTag(tag);
                    }}
                  >
                    <Icons.Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="tag-action-btn danger"
                    aria-label="Delete tag"
                    disabled={tag.system}
                    onClick={async (event) => {
                      event.stopPropagation();
                      if (tag.system) return;
                      try {
                        await deleteTagDef(tag.id as Tag);
                      } catch (error) {
                        console.error('Failed to delete tag:', error);
                      }
                    }}
                  >
                    <Icons.Trash2 size={12} />
                  </button>
                </span>
                {hasTag ? <span className="tag-check">✓</span> : null}
              </div>
            );
          })}
          <div
            className="graph-context-menu-item tag-option tag-option-new"
            onClick={(event) => {
              event.stopPropagation();
              onCreateTag();
            }}
          >
            <span className="tag-pill tag-pill-new">New Tag...</span>
          </div>
        </div>
      </div>

      <div
        className="graph-context-menu-item"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(node.data.url);
          } catch (error) {
            console.error('Failed to copy URL:', error);
          }
          closeContextMenu();
        }}
      >
        Copy URL
      </div>
      {hasTitle && (
        <div
          className="graph-context-menu-item"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(node.data.title || 'Untitled');
            } catch (error) {
              console.error('Failed to copy title:', error);
            }
            closeContextMenu();
          }}
        >
          Copy title
        </div>
      )}

      <div className="graph-context-menu-divider" />

      {!isRoot && (
        <div
          className="graph-context-menu-item danger"
          onClick={() => {
            fireAndForget(msg.deleteNode({ nodeId }));
            closeContextMenu();
          }}
        >
          Delete node
        </div>
      )}
      {hasChildren && (
        <div
          className="graph-context-menu-item danger"
          onClick={() => {
            fireAndForget(msg.deleteChildren({ nodeId }));
            closeContextMenu();
          }}
        >
          Delete children
        </div>
      )}
      <div
        className="graph-context-menu-item danger"
        onClick={() => {
          fireAndForget(msg.deleteWithChildren({ nodeId }));
          closeContextMenu();
        }}
      >
        {isRoot && !hasChildren ? 'Delete tree' : 'Delete with children'}
      </div>
        </div>
      </div>
    </>
  );
}

type BulkMenuProps = {
  nodeIds: NodeId[];
  position: { x: number; y: number };
};

function BulkContextMenu({ nodeIds, position }: BulkMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuStyle = useMenuPosition(menuRef, position);
  const closeContextMenu = useStore((state) => state.closeContextMenu);
  const clearSelection = useStore((state) => state.clearSelection);
  const tree = useStore((state) => state.tree);
  const tagDefsList = useStore((state) => state.tagDefsList);

  const selectedNodes = useMemo(() => {
    if (!tree) return [];
    return nodeIds
      .map((id) => tree.findNodeById(id))
      .filter((node): node is NonNullable<typeof node> => Boolean(node));
  }, [nodeIds, tree]);

  const tagCounts = useMemo(() => {
    const counts = new Map<Tag, number>();
    if (selectedNodes.length === 0) return counts;
    selectedNodes.forEach((node) => {
      node.data.tags?.forEach((tagId) => {
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
      });
    });
    return counts;
  }, [selectedNodes]);

  const toggleTagForSelection = (tagId: Tag) => {
    if (!tree) return;
    if (selectedNodes.length === 0) return;
    const count = tagCounts.get(tagId) ?? 0;
    const shouldRemove = count === selectedNodes.length;
    selectedNodes.forEach((node) => {
      const hasTag = node.data.tags?.includes(tagId);
      if (shouldRemove && hasTag) {
        fireAndForget(msg.removeTag({ nodeId: node.id, tagId }));
      } else if (!shouldRemove && !hasTag) {
        fireAndForget(msg.addTag({ nodeId: node.id, tagId }));
      }
    });
    clearSelection();
    closeContextMenu();
  };

  return (
    <div
      ref={menuRef}
      className="graph-context-menu"
      style={{
        left: `${menuStyle.left}px`,
        top: `${menuStyle.top}px`,
        // @ts-ignore -- Allow custom CSS prop for menu max height
        ['--menu-max-height' as const]: `${menuStyle.maxHeight}px`,
      }}
    >
      <div className="graph-context-menu-content">
      <div className="graph-context-menu-header">{nodeIds.length} nodes selected</div>
      <div className="graph-context-menu-divider" />
      <div
        className="graph-context-menu-item"
        onClick={() => {
          fireAndForget(msg.bulkPin({ nodeIds }));
          clearSelection();
          closeContextMenu();
        }}
      >
        Pin selected
      </div>
      <div
        className="graph-context-menu-item"
        onClick={() => {
          fireAndForget(msg.bulkUnpin({ nodeIds }));
          clearSelection();
          closeContextMenu();
        }}
      >
        Unpin selected
      </div>
      <div className="graph-context-menu-item has-submenu">
        Tags <span className="submenu-arrow">›</span>
        <div className="graph-context-submenu">
          {tagDefsList.map((tag) => {
            const count = tagCounts.get(tag.id as Tag) ?? 0;
            const allSelected = selectedNodes.length > 0 && count === selectedNodes.length;
            const someSelected = count > 0 && count < selectedNodes.length;
            return (
              <div
                key={tag.id as string}
                className="graph-context-menu-item tag-option"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleTagForSelection(tag.id as Tag);
                }}
              >
                <span className="tag-pill" style={{ '--tag-color': tag.color } as React.CSSProperties}>
                  {tag.label}
                </span>
                {allSelected ? <span className="tag-check">✓</span> : null}
                {someSelected ? <span className="tag-check partial">•</span> : null}
              </div>
            );
          })}
        </div>
      </div>
      <div
        className="graph-context-menu-item"
        onClick={() => {
          fireAndForget(msg.bulkCloseTabs({ nodeIds }));
          clearSelection();
          closeContextMenu();
        }}
      >
        Close selected tabs
      </div>
      <div className="graph-context-menu-divider" />
      <div
        className="graph-context-menu-item danger"
        onClick={() => {
          fireAndForget(msg.bulkDeleteNodes({ nodeIds }));
          clearSelection();
          closeContextMenu();
        }}
      >
        Delete nodes
      </div>
      <div
        className="graph-context-menu-item danger"
        onClick={() => {
          fireAndForget(msg.bulkDeleteRecursive({ nodeIds }));
          clearSelection();
          closeContextMenu();
        }}
      >
        Delete nodes recursively
      </div>
      </div>
    </div>
  );
}
