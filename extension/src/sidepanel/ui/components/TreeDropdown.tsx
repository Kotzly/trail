import { useEffect, useMemo, useRef, useState } from 'react';
import { openTree, renameTree } from '../../api/tree.js';
import { useStore } from '../state/store.js';
import { useOverlayEffects } from '../state/overlay-effects.js';
import { Icons } from './Icon.js';
import React from 'react';
import type { FaviconUrl, Title, Url } from '../../../shared/types/ids.js';

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

  return (
    <div className="trees-dropdown-wrapper">
      <button
        ref={triggerRef}
        id="treesBtn"
        className="matte-circle-btn orb-button"
        type="button"
        title="Saved trees"
        onClick={() => setTreesOpen(!treesOpen)}
      >
        <Icons.BookOpen size={20} />
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
                <button
                  className="trees-dropdown-item-action"
                  type="button"
                  title="Rename tree"
                  onClick={(event) => {
                    event.stopPropagation();
                    startEdit(activeTree);
                  }}
                >
                  <Icons.Pencil size={14} />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="trees-dropdown-section">
          <div className="trees-dropdown-section-title">saved</div>
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
                    <button
                      className="trees-dropdown-item-action"
                      type="button"
                      title="Rename tree"
                      onClick={(event) => {
                        event.stopPropagation();
                        startEdit(tree);
                      }}
                    >
                      <Icons.Pencil size={14} />
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        <div className="trees-dropdown-hint">click a tree to open · edit to rename</div>
      </div>
    </div>
  );
}
