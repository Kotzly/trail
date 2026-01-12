import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { NodeId, Tag } from '../../../shared/types/ids.js';
import type { TagDefinition } from '../../../shared/types/tags.js';
import { msg } from '../../../shared/types/messages.js';
import { fireAndForget } from '../../api/background.js';
import { navigateTo } from '../../api/tree.js';
import { getTabsForNodeMessage } from '../../api/tabs.js';
import { useStore } from '../state/store.js';
import TagEditorModal from './tags/TagEditorModal.js';
import { upsertTagDef } from '../../api/tags.js';
import { TagIcon } from './tags/TagIcon.js';
import { Icons } from './Icon.js';
import React from 'react';

type MenuPosition = { left: number; top: number };

const SUBMENU_MIN_WIDTH = 160;

function useMenuPosition(menuRef: RefObject<HTMLDivElement>, position: { x: number; y: number }) {
  const [menuStyle, setMenuStyle] = useState<MenuPosition>({ left: position.x, top: position.y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    let left = position.x;
    let top = position.y;
    if (rect.right > window.innerWidth) {
      left = window.innerWidth - rect.width - 8;
    }
    if (rect.bottom > window.innerHeight) {
      top = window.innerHeight - rect.height - 8;
    }
    setMenuStyle({ left, top });
  }, [menuRef, position.x, position.y]);

  return menuStyle;
}

export default function ContextMenus() {
  const contextMenu = useStore((state) => state.contextMenu);
  const closeContextMenu = useStore((state) => state.closeContextMenu);
  const tree = useStore((state) => state.tree);
  const [tagEditorState, setTagEditorState] = useState<{
    open: boolean;
    nodeId: NodeId | null;
    initial?: TagDefinition | null;
  }>({ open: false, nodeId: null, initial: null });

  useEffect(() => {
    if (!contextMenu) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if ((target as HTMLElement).closest('.graph-context-menu')) return;
      closeContextMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu();
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
      mode="create"
      initial={tagEditorState.initial}
      onCancel={() => setTagEditorState({ open: false, nodeId: null })}
      onSubmit={async (value) => {
        if (!tagEditorState.nodeId) {
          setTagEditorState({ open: false, nodeId: null });
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
        try {
          await upsertTagDef(tagDef);
          fireAndForget(msg.addTag({ nodeId: tagEditorState.nodeId, tagId: id }));
        } catch (error) {
          console.error('Failed to create tag:', error);
        } finally {
          setTagEditorState({ open: false, nodeId: null });
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
            setTagEditorState({ open: true, nodeId: contextMenu.nodeId, initial: null });
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
};

function NodeContextMenu({ nodeId, position, onCreateTag }: NodeMenuProps) {
  const closeContextMenu = useStore((state) => state.closeContextMenu);
  const tree = useStore((state) => state.tree);
  const tagDefsList = useStore((state) => state.tagDefsList);
  const node = tree?.findNodeById(nodeId);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuStyle = useMenuPosition(menuRef, position);
  const [submenuLeft, setSubmenuLeft] = useState(false);
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);

  const updateSubmenuDirection = useCallback(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const required = SUBMENU_MIN_WIDTH + 8;
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;
    const shouldFlip = spaceRight < required && spaceLeft >= required;
    setSubmenuLeft(shouldFlip);
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
    updateSubmenuDirection();
  }, [menuStyle.left, menuStyle.top, updateSubmenuDirection]);

  useEffect(() => {
    window.addEventListener('resize', updateSubmenuDirection);
    return () => window.removeEventListener('resize', updateSubmenuDirection);
  }, [updateSubmenuDirection]);

  const hasOpenTab = tabs.length > 0;
  const tabInfo = tabs[0];
  const hasTitle = Boolean(node?.data.title && node.data.title.trim().length > 0);
  const hasChildren = node?.getChildren()?.length ? node.getChildren().length > 0 : false;
  const isRoot = node?.isRoot() ?? false;

  if (!node) return null;

  return (
    <>
      <div
        ref={menuRef}
        className={`graph-context-menu${submenuLeft ? ' submenu-left' : ''}`}
        style={{ left: `${menuStyle.left}px`, top: `${menuStyle.top}px` }}
      >
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
          <div
            className="graph-context-menu-item"
            onClick={() => {
              if (!tabInfo?.id) return;
              void chrome.tabs.update(tabInfo.id, { muted: !tabInfo.mutedInfo?.muted });
            }}
          >
            {tabInfo?.mutedInfo?.muted ? 'Unmute tab' : 'Mute tab'}
          </div>
          <div
            className="graph-context-menu-item"
            onClick={() => {
              if (!tabInfo?.id) return;
              void chrome.tabs.update(tabInfo.id, { pinned: !tabInfo.pinned });
            }}
          >
            {tabInfo?.pinned ? 'Unpin tab' : 'Pin tab'}
          </div>
          <div
            className="graph-context-menu-item"
            onClick={() => {
              if (!tabInfo?.id) return;
              void chrome.tabs.duplicate(tabInfo.id);
            }}
          >
            Duplicate tab
          </div>
          <div
            className="graph-context-menu-item"
            onClick={() => {
              if (!tabInfo?.id) return;
              void chrome.tabs.remove(tabInfo.id);
              closeContextMenu();
            }}
          >
            Close tab
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
                <span className="tag-dot" style={{ background: tag.color }}>
                  <TagIcon id={tag.iconId} size={12} />
                </span>
                <span className="tag-label">{tag.label}</span>
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
            <span className="tag-dot tag-dot-new">
              <Icons.Plus size={12} />
            </span>
            <span className="tag-label">New Tag...</span>
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

  return (
    <div ref={menuRef} className="graph-context-menu" style={{ left: `${menuStyle.left}px`, top: `${menuStyle.top}px` }}>
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
          fireAndForget(msg.bulkDelete({ nodeIds }));
          clearSelection();
          closeContextMenu();
        }}
      >
        Delete selected
      </div>
    </div>
  );
}
