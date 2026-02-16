import { useEffect, useMemo, useRef, useState } from 'react';
import { createNewTree, deleteArchivedTree, ensureTreeLoaded, exportTree, openTree, renameTree, syncTrees } from '../../api/tree.js';
import { getBackendConfig, initBackendConfig } from '../../../shared/config/backend.js';
import { useStore } from '../state/store.js';
import { useOverlayEffects } from '../state/overlay-effects.js';
import { useAnchoredDropdown } from '../hooks/useAnchoredDropdown.js';
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
  stub?: boolean;
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

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim() || 'trail';
}

function downloadBundle(bundle: import('../../../shared/types/export.js').TrailExportBundle): void {
  const label = bundle.source.treeLabel ?? 'trail';
  const json = JSON.stringify(bundle);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(label)}.trail.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  useAnchoredDropdown({ open: treesOpen, dropdownRef });

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
        (entry) => {
          const item: TreeItem = {
            id: entry.id,
            label: entry.label,
            nodeCount: entry.nodeCount,
            rootUrl: entry.rootUrl,
            rootTitle: entry.rootTitle,
            rootFavicon: entry.rootFavicon,
            savedAt: entry.savedAt,
          };
          if ('stub' in entry && (entry as { stub?: boolean }).stub) {
            item.stub = true;
          }
          return item;
        },
      );
  }, [trees.archived]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const editing = editingId !== null;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const [loadingTreeId, setLoadingTreeId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!treesOpen) {
      setEditingId(null);
      setDraft('');
      return;
    }

    let cancelled = false;
    const doSync = async () => {
      try {
        setSyncing(true);
        await syncTrees();
      } catch (error) {
        console.warn('Failed to sync trees:', error);
      } finally {
        if (!cancelled) {
          setSyncing(false);
        }
      }
    };
    void doSync();

    return () => {
      cancelled = true;
    };
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

  const handleOpen = async (tree: TreeItem) => {
    try {
      if (tree.stub) {
        setLoadingTreeId(tree.id);
        await ensureTreeLoaded(tree.id);
      }
      await openTree(tree.id);
    } catch (error) {
      console.error('Failed to open tree:', error);
    } finally {
      setLoadingTreeId(null);
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

  const handleExport = async (treeId?: string) => {
    try {
      const bundle = await exportTree(treeId);
      downloadBundle(bundle);
    } catch (error) {
      console.error('Failed to export tree:', error);
    }
  };

  const openTrailEditor = async (treeId: string) => {
    try {
      await initBackendConfig();
      const baseUrl = getBackendConfig().baseUrl;
      await chrome.tabs.create({ url: `${baseUrl}/trails/${treeId}`, active: true });
    } catch (error) {
      console.error('Failed to open trail editor:', error);
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
          <div className="trees-dropdown-heading">
            <span className="trees-dropdown-title">trees</span>
            <span className="trees-dropdown-count">{archivedTrees.length}</span>
          </div>
          <button
            className="dropdown-close-btn trees-dropdown-close"
            type="button"
            aria-label="Close trees list"
            onClick={() => setTreesOpen(false)}
          >
            <Icons.X size={14} />
          </button>
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
                  <div
                    className="trees-dropdown-item-title"
                    onDoubleClick={() => startEdit(activeTree)}
                  >
                    {activeTree.label}
                  </div>
                )}
                <div className="trees-dropdown-item-meta">active now · {activeTree.nodeCount} nodes</div>
              </div>
              {editingId !== activeTree.id ? (
                <div className="trees-dropdown-item-actions">
                  <button
                    className="trees-dropdown-item-action"
                    type="button"
                    aria-label="Export tree"
                    data-tooltip="Export tree"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleExport();
                    }}
                  >
                    <Icons.Download size={12} />
                  </button>
                  <button
                    className="trees-dropdown-item-action"
                    type="button"
                    aria-label="Open in editor"
                    data-tooltip="Open in editor"
                    onClick={(event) => {
                      event.stopPropagation();
                      void openTrailEditor(activeTree.id);
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
              <Icons.GitBranchPlus size={14} />
            </button>
          </div>
          {archivedTrees.length === 0 ? (
            <div className="trees-dropdown-empty">no saved trees</div>
          ) : (
            archivedTrees.map((tree) => {
              const isLoading = loadingTreeId === tree.id;
              const host = formatHost(tree.rootUrl);
              const date = formatDate(tree.savedAt);
              const meta = [
                tree.stub ? 'cloud' : null,
                host || tree.rootTitle || 'Untitled',
                `${tree.nodeCount} nodes`,
                date,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <div
                  key={tree.id}
                  className={`trees-dropdown-item${isLoading ? ' loading' : ''}`}
                  onClick={() => !isLoading && void handleOpen(tree)}
                >
                  {isLoading ? (
                    <div className="trees-dropdown-item-favicon placeholder">
                      <Icons.Loader2 size={14} className="spin" />
                    </div>
                  ) : tree.stub ? (
                    <div className="trees-dropdown-item-favicon placeholder">
                      <Icons.Cloud size={14} />
                    </div>
                  ) : tree.rootFavicon ? (
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
                      <div
                        className="trees-dropdown-item-title"
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          startEdit(tree);
                        }}
                      >
                        {tree.label}
                      </div>
                    )}
                    <div className="trees-dropdown-item-meta">{meta}</div>
                  </div>
                  {editingId !== tree.id && !isLoading ? (
                    <div className="trees-dropdown-item-actions">
                      {!tree.stub ? (
                        <button
                          className="trees-dropdown-item-action"
                          type="button"
                          aria-label="Export tree"
                          data-tooltip="Export tree"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleExport(tree.id);
                          }}
                        >
                          <Icons.Download size={12} />
                        </button>
                      ) : null}
                      <button
                        className="trees-dropdown-item-action"
                        type="button"
                        aria-label="Open in editor"
                        data-tooltip="Open in editor"
                        onClick={(event) => {
                          event.stopPropagation();
                          void openTrailEditor(tree.id);
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
