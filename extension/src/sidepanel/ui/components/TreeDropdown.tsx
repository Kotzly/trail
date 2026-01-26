import { useEffect, useMemo, useRef, useState } from 'react';
import { createNewTree, deleteArchivedTree, openTree, renameTree } from '../../api/tree.js';
import { useStore } from '../state/store.js';
import { useOverlayEffects } from '../state/overlay-effects.js';
import { Icons } from './Icon.js';
import React from 'react';
import type { FaviconUrl, Title, Url } from '../../../shared/types/ids.js';
import { createPortal } from 'react-dom';

type TreeItem = {
  id: string;
  label: string;
  nodeCount: number;
  rootUrl?: Url;
  rootTitle?: Title;
  rootFavicon?: FaviconUrl;
  savedAt?: number;
};

function formatHost(url?: Url): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function formatDate(ts?: number): string {
  if (!ts) return '';
  try {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return '';
  }
}

export default function TreeDropdown() {
  const trees = useStore((state) => state.trees);
  const treesOpen = useStore((state) => state.ui.treesOpen);
  const setTreesOpen = useStore((state) => state.setTreesOpen);
  const closeAllPopups = useStore((state) => state.closeAllPopups);
  const confirmNewTree = useStore((state) => state.settings?.confirmNewTree ?? true);
  const treesShortcut = 'Shift+T';
  const nodeCount = useStore((state) => state.nodeCount);

  useOverlayEffects(treesOpen, { kind: 'dropdown' });

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const activeTree = trees.active
    ? ({
        id: trees.active.id,
        label: trees.active.label,
        nodeCount,
      } as TreeItem)
    : null;

  const archivedTrees = useMemo(() => {
    return [...trees.archived]
      .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
      .map(
        (entry) =>
          ({
            id: entry.id,
            label: entry.label,
            nodeCount: entry.nodeCount,
            rootUrl: entry.rootUrl,
            rootTitle: entry.rootTitle,
            rootFavicon: entry.rootFavicon,
            savedAt: entry.savedAt,
          }) as TreeItem,
      );
  }, [trees.archived]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const editing = editingId !== null;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!treesOpen) {
      setEditingId(null);
      setDraft('');
    }
  }, [treesOpen]);

  useEffect(() => {
    if (!treesOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setTreesOpen(false);
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (dropdownRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setTreesOpen(false);
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onMouseDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onMouseDown, true);
    };
  }, [setTreesOpen, treesOpen]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const startEdit = (tree: TreeItem) => {
    setEditingId(tree.id);
    setDraft(tree.label);
  };

  const commitEdit = async () => {
    if (!editingId) return;
    const nextLabel = draft.trim() || 'Unnamed Tree';
    try {
      await renameTree(editingId, nextLabel);
    } catch (error) {
      console.error('Failed to rename tree:', error);
    } finally {
      setEditingId(null);
      setDraft('');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
  };

  const handleOpen = async (treeId: string) => {
    try {
      await openTree(treeId);
    } catch (error) {
      console.error('Failed to open tree:', error);
    } finally {
      setTreesOpen(false);
    }
  };

  const handleDeleteArchived = async (treeId: string) => {
    try {
      await deleteArchivedTree(treeId);
    } catch (error) {
      console.error('Failed to delete saved tree:', error);
    }
  };

  const handleNewTree = async () => {
    try {
      const label = labelDraft.trim() || 'Unnamed Tree';
      setCreating(true);
      await createNewTree(label);
    } catch (error) {
      console.error('Failed to create new tree:', error);
    } finally {
      setCreating(false);
    }
  };

  const treesTooltip = `Saved trees (${treesShortcut})`;

  return (
    <div className="trees-dropdown-wrapper">
      <button
        ref={triggerRef}
        id="treesBtn"
        className="matte-circle-btn orb-button"
        type="button"
        aria-label={treesTooltip}
        data-tooltip={treesTooltip}
        onClick={() => setTreesOpen(!treesOpen)}
      >
        <Icons.ListTree size={20} />
      </button>
      <div
        ref={dropdownRef}
        id="treesDropdown"
        className={`trees-dropdown ${treesOpen ? '' : 'hidden'}`}
        aria-hidden={!treesOpen}
      >
        <div className="trees-dropdown-header">
          <span className="trees-dropdown-title">trees</span>
          <span className="trees-dropdown-count">{archivedTrees.length}</span>
        </div>
        {activeTree ? (
          <div className="trees-dropdown-section">
            <div className="trees-dropdown-section-title">current</div>
            <div className="trees-dropdown-item active">
              <div className="trees-dropdown-item-info">
                {editingId === activeTree.id ? (
                  <input
                    ref={inputRef}
                    className="trees-dropdown-item-input"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void commitEdit();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelEdit();
                      }
                    }}
                    onBlur={() => void commitEdit()}
                  />
                ) : (
                  <div className="trees-dropdown-item-title">{activeTree.label}</div>
                )}
                <div className="trees-dropdown-item-meta">active now · {activeTree.nodeCount} nodes</div>
              </div>
              {editingId !== activeTree.id ? (
                <div className="trees-dropdown-item-actions">
                  <button
                    className="trees-dropdown-item-action"
                    type="button"
                    aria-label="Rename tree"
                    data-tooltip="Rename tree"
                    onClick={(event) => {
                      event.stopPropagation();
                      startEdit(activeTree);
                    }}
                  >
                    <Icons.Pencil size={12} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="trees-dropdown-section">
          <div className="trees-dropdown-section-header">
            <div className="trees-dropdown-section-title">saved</div>
            <button
              id="newTreeBtn"
              className="trees-dropdown-section-action"
              type="button"
              aria-label="New tree"
              data-tooltip="New tree"
              onClick={() => {
                setLabelDraft('');
                closeAllPopups();
                setConfirmOpen(true);
              }}
            >
              <Icons.ListTree size={14} />
            </button>
          </div>
          {archivedTrees.length === 0 ? (
            <div className="trees-dropdown-empty">no saved trees</div>
          ) : (
            archivedTrees.map((tree) => {
              const host = formatHost(tree.rootUrl);
              const date = formatDate(tree.savedAt);
              const meta = [
                host || tree.rootTitle || 'Untitled',
                `${tree.nodeCount} nodes`,
                date,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <div
                  key={tree.id}
                  className="trees-dropdown-item"
                  onClick={() => void handleOpen(tree.id)}
                >
                  {tree.rootFavicon ? (
                    <img className="trees-dropdown-item-favicon" alt="" src={tree.rootFavicon} />
                  ) : (
                    <div className="trees-dropdown-item-favicon placeholder">
                      <Icons.Bookmark size={14} />
                    </div>
                  )}
                  <div className="trees-dropdown-item-info">
                    {editingId === tree.id ? (
                      <input
                        ref={inputRef}
                        className="trees-dropdown-item-input"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void commitEdit();
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelEdit();
                          }
                        }}
                        onBlur={() => void commitEdit()}
                        onClick={(event) => event.stopPropagation()}
                      />
                    ) : (
                      <div className="trees-dropdown-item-title">{tree.label}</div>
                    )}
                    <div className="trees-dropdown-item-meta">{meta}</div>
                  </div>
                  {editingId !== tree.id ? (
                    <div className="trees-dropdown-item-actions">
                      <button
                        className="trees-dropdown-item-action"
                        type="button"
                        aria-label="Rename tree"
                        data-tooltip="Rename tree"
                        onClick={(event) => {
                          event.stopPropagation();
                          startEdit(tree);
                        }}
                      >
                        <Icons.Pencil size={12} />
                      </button>
                      <button
                        className="trees-dropdown-item-action"
                        type="button"
                        aria-label="Delete tree"
                        data-tooltip="Delete tree"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteArchived(tree.id);
                        }}
                      >
                        <Icons.Trash2 size={12} />
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        <div className="trees-dropdown-hint">click a tree to open · edit to rename</div>
      </div>
      <ConfirmOverlay
        open={confirmOpen}
        confirmNewTree={confirmNewTree}
        label={labelDraft}
        creating={creating}
        onLabelChange={setLabelDraft}
        onCancel={() => {
          if (creating) return;
          setConfirmOpen(false);
        }}
        onConfirm={() => {
          if (creating) return;
          setConfirmOpen(false);
          void handleNewTree();
        }}
      />
    </div>
  );
}

type ConfirmOverlayProps = {
  open: boolean;
  confirmNewTree: boolean;
  label: string;
  creating: boolean;
  onLabelChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

function ConfirmOverlay({
  open,
  confirmNewTree,
  label,
  creating,
  onLabelChange,
  onCancel,
  onConfirm,
}: ConfirmOverlayProps) {
  useOverlayEffects(open, { lod: true, blur: true, kind: 'modal' });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onCancel, open]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="confirm-overlay lod-enabler blur-enabler"
      onClick={onCancel}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="confirm-dialog"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-title">
          {confirmNewTree ? 'create a new tree?' : 'name your new tree'}
        </div>
        <input
          className="confirm-input"
          type="text"
          value={label}
          placeholder="Unnamed Tree"
          onChange={(event) => onLabelChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onConfirm();
            }
          }}
          autoFocus
        />
        <div className="confirm-actions">
          <button className="confirm-btn ghost" type="button" onClick={onCancel} disabled={creating}>
            Cancel
          </button>
          <button className="confirm-btn" type="button" onClick={onConfirm} disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
