import { useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId, Tag } from '../../../../shared/types/ids.js';
import { navigateTo } from '../../../api/tree.js';
import { useStore } from '../../state/store.js';
import { Icons } from '../Icon.js';
import { collectTagCounts, collectTaggedNodes, filterNodesByTags } from './tag-filter-utils.js';
import React from 'react';

export default function TagFilterDropdown() {
  const tree = useStore((state) => state.tree);
  const tagDefsList = useStore((state) => state.tagDefsList);
  const tagFilterOpen = useStore((state) => state.ui.tagFilterOpen);
  const setTagFilterOpen = useStore((state) => state.setTagFilterOpen);
  const selected = useStore((state) => state.tagFilter.selected);
  const toggleTagFilterTag = useStore((state) => state.toggleTagFilterTag);
  const setTagFilterSelected = useStore((state) => state.setTagFilterSelected);
  const clearTagFilter = useStore((state) => state.clearTagFilter);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const tagCounts = useMemo(() => collectTagCounts(tree), [tree]);
  const usedTags = useMemo(
    () => tagDefsList.filter((tag) => (tagCounts.get(tag.id as Tag) ?? 0) > 0),
    [tagCounts, tagDefsList],
  );
  const taggedNodes = useMemo(() => collectTaggedNodes(tree), [tree]);
  const filteredNodes = useMemo(
    () => (selected.size > 0 ? filterNodesByTags(tree, selected) : taggedNodes),
    [taggedNodes, selected, tree],
  );

  useEffect(() => {
    if (!tagFilterOpen) return;
    setFocusedIndex((prev) => Math.min(prev, Math.max(0, filteredNodes.length - 1)));
  }, [filteredNodes.length, tagFilterOpen]);

  useEffect(() => {
    if (!tagFilterOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setTagFilterOpen(false);
        return;
      }
      if (filteredNodes.length === 0) return;
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusedIndex((prev) =>
          filteredNodes.length === 0 ? 0 : (prev - 1 + filteredNodes.length) % filteredNodes.length,
        );
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setFocusedIndex((prev) =>
          filteredNodes.length === 0 ? 0 : (prev + 1) % filteredNodes.length,
        );
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const node = filteredNodes[focusedIndex];
        if (node) void handleNavigate(node.id);
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (dropdownRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setTagFilterOpen(false);
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onMouseDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onMouseDown, true);
    };
  }, [filteredNodes, focusedIndex, setTagFilterOpen, tagFilterOpen]);

  const handleNavigate = async (nodeId: NodeId) => {
    const node = tree?.findNodeById(nodeId);
    if (!node) return;
    try {
      await navigateTo(node);
    } catch (error) {
      console.error('TagFilterDropdown: navigateTo failed', error);
    } finally {
      setTagFilterOpen(false);
    }
  };

  useEffect(() => {
    if (usedTags.length === 0) {
      if (selected.size > 0) clearTagFilter();
      return;
    }
    const allowed = new Set(usedTags.map((tag) => tag.id as Tag));
    const nextSelected = new Set<Tag>();
    selected.forEach((tagId) => {
      if (allowed.has(tagId)) nextSelected.add(tagId);
    });
    if (nextSelected.size !== selected.size) {
      setTagFilterSelected(nextSelected);
    }
  }, [clearTagFilter, selected, setTagFilterSelected, usedTags]);

  const selectedCount = selected.size;
  const hasSelected = selectedCount > 0;
  const hasTaggedNodes = taggedNodes.length > 0;
  const showEmptyTags = usedTags.length === 0;
  const isEmpty = filteredNodes.length === 0;

  return (
    <div className="tag-filter-dropdown-wrapper">
      <button
        ref={triggerRef}
        id="tagFilterBtn"
        className="btn-icon orb-button"
        type="button"
        title="Filter by tags"
        onClick={() => setTagFilterOpen(!tagFilterOpen)}
      >
        <Icons.Tag size={18} />
      </button>
      <div
        ref={dropdownRef}
        id="tagFilterDropdown"
        className={`tag-filter-dropdown ${tagFilterOpen ? '' : 'hidden'}`}
      >
        <div className="tag-filter-header">
          <div className="tag-filter-title">tags</div>
          <div className="tag-filter-header-actions">
            {hasSelected ? (
              <button className="tag-filter-clear" type="button" onClick={clearTagFilter}>
                Clear
              </button>
            ) : null}
            <span className="tag-filter-count">{filteredNodes.length}</span>
          </div>
        </div>

        <div className="tag-filter-strip">
          {showEmptyTags ? (
            <div className="tag-filter-empty">no tags yet</div>
          ) : (
            usedTags.map((tag) => {
              const isSelected = selected.has(tag.id as Tag);
              return (
                <button
                  key={tag.id as string}
                  className={`tag-filter-tag${isSelected ? ' selected' : ''}`}
                  type="button"
                  onClick={() => toggleTagFilterTag(tag.id as Tag)}
                >
                  <span className="tag-pill" style={{ '--tag-color': tag.color } as React.CSSProperties}>
                    {tag.label}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="tag-filter-results">
          {!hasTaggedNodes ? (
            <div className="tag-filter-empty">no tagged nodes yet</div>
          ) : isEmpty ? (
            <div className="tag-filter-empty">no nodes with selected tags</div>
          ) : (
            filteredNodes.map((node, idx) => {
              const title = node.data.title || 'Untitled';
              const url = node.data.url || '';
              const hostname = safeHostname(url);
              return (
                <div
                  key={node.id}
                  className={`tag-filter-node ${idx === focusedIndex ? 'focused' : ''}`}
                  onClick={() => void handleNavigate(node.id)}
                  onMouseOver={() => setFocusedIndex(idx)}
                >
                  {node.data.favicon ? (
                    <img className="tag-filter-node-favicon" alt="" src={node.data.favicon} />
                  ) : (
                    <div className="tag-filter-node-favicon placeholder">
                      <Icons.Tag size={12} />
                    </div>
                  )}
                  <div className="tag-filter-node-info">
                    <div className="tag-filter-node-title">{title}</div>
                    <div className="tag-filter-node-url">{hostname}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="tag-filter-hint">click tags to filter · esc close</div>
      </div>
    </div>
  );
}

function safeHostname(url: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
