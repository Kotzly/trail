import { useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId, Tag, Url } from '@shared/types/ids.js';
import { getFaviconUrl } from '@shared/utils/favicon.js';
import type { TagDefinition } from '@shared/types/tags.js';
import { navigateTo } from '../../../api/tree.js';
import { useStore } from '../../state/store.js';
import { useOverlayEffects } from '../../state/overlay-effects.js';
import { useAnchoredDropdown } from '../../hooks/useAnchoredDropdown.js';
import { Icons } from '../Icon.js';
import { TagIcon } from './TagIcon.js';
import { collectTagCounts, collectTaggedNodes, filterNodesByTags } from './tag-filter-utils.js';


export default function TagFilterDropdown() {
  const tree = useStore((state) => state.tree);
  const tagDefsList = useStore((state) => state.tagDefsList);
  const tagFilterOpen = useStore((state) => state.ui.tagFilterOpen);
  const setTagFilterOpen = useStore((state) => state.setTagFilterOpen);
  const selected = useStore((state) => state.tagFilter.selected);
  const toggleTagFilterTag = useStore((state) => state.toggleTagFilterTag);
  const setTagFilterSelected = useStore((state) => state.setTagFilterSelected);
  const clearTagFilter = useStore((state) => state.clearTagFilter);
  const tagFilterShortcut = 'Shift+F';

  useOverlayEffects(tagFilterOpen, { kind: 'dropdown' });

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  useAnchoredDropdown({ open: tagFilterOpen, dropdownRef });

  const tagCounts = useMemo(() => collectTagCounts(tree), [tree]);
  const tagDefMap = useMemo(() => {
    const map = new Map<Tag, TagDefinition>();
    tagDefsList.forEach((tag) => map.set(tag.id as Tag, tag));
    return map;
  }, [tagDefsList]);
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
  const tagFilterTooltip = `Filter by tags (${tagFilterShortcut})`;

  return (
    <div className="tag-filter-dropdown-wrapper">
      <button
        ref={triggerRef}
        id="tagFilterBtn"
        className="matte-circle-btn orb-button"
        type="button"
        aria-label={tagFilterTooltip}
        data-tooltip={tagFilterTooltip}
        onClick={() => setTagFilterOpen(!tagFilterOpen)}
      >
        <Icons.Tag size={18} />
      </button>
      <div
        ref={dropdownRef}
        id="tagFilterDropdown"
        className={`tag-filter-dropdown ${tagFilterOpen ? '' : 'hidden'}`}
        aria-hidden={!tagFilterOpen}
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
            <button
              className="dropdown-close-btn tag-filter-close"
              type="button"
              aria-label="Close tag filter"
              onClick={() => setTagFilterOpen(false)}
            >
              <Icons.X size={14} />
            </button>
          </div>
        </div>

        {showEmptyTags ? null : (
          <div className="tag-filter-strip">
            {usedTags.map((tag) => {
              const isSelected = selected.has(tag.id as Tag);
              return (
                <button
                  key={tag.id as string}
                  className={`tag-filter-tag${isSelected ? ' selected' : ''}`}
                  type="button"
                  onClick={() => toggleTagFilterTag(tag.id as Tag)}
                >
                  <span className="tag-pill" style={{ '--tag-color': tag.color } as React.CSSProperties}>
                    <TagIcon id={tag.iconId} size={10} />
                    {tag.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="tag-filter-results">
          {!hasTaggedNodes ? (
            <div className="tag-filter-empty">
              <Icons.Tag size={24} />
              <span>No tagged nodes yet</span>
              <span className="tag-filter-empty-hint">Right-click a node to add tags</span>
            </div>
          ) : isEmpty ? (
            <div className="tag-filter-empty">
              <Icons.Search size={24} />
              <span>No nodes with selected tags</span>
            </div>
          ) : (
            filteredNodes.map((node, idx) => {
              const title = node.data.title || 'Untitled';
              const url = node.data.url;
              const hostname = safeHostname(url);
              const nodeTags = node.data.tags ?? [];
              return (
                <div
                  key={node.id}
                  className={`tag-filter-node ${idx === focusedIndex ? 'focused' : ''}`}
                  onClick={() => void handleNavigate(node.id)}
                  onMouseOver={() => setFocusedIndex(idx)}
                >
                  {node.data.url ? (
                    <img className="tag-filter-node-favicon" alt="" src={getFaviconUrl(node.data.url)} />
                  ) : (
                    <div className="tag-filter-node-favicon placeholder">
                      <Icons.Tag size={12} />
                    </div>
                  )}
                  <div className="tag-filter-node-info">
                    <div className="tag-filter-node-title">{title}</div>
                    <div className="tag-filter-node-url">{hostname}</div>
                    {nodeTags.length > 0 ? (
                      <div className="tag-filter-node-tags">
                        {nodeTags.map((tagId) => {
                          const def = tagDefMap.get(tagId as Tag);
                          return (
                            <span
                              key={tagId as string}
                              className="tag-pill tag-pill-sm"
                              style={{ '--tag-color': def?.color ?? '#667085' } as React.CSSProperties}
                              title={def?.label ?? (tagId as string)}
                            >
                              <TagIcon id={def?.iconId ?? 'Tag'} size={8} />
                              {def?.label ?? (tagId as string)}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function safeHostname(url: Url): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
