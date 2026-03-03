import { useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId } from '../../../../shared/types/ids.js';
import { getFaviconUrl } from '../../../../shared/utils/favicon.js';
import { navigateTo } from '../../api/tree.js';
import { useStore } from '../state/store.js';
import { useOverlayEffects } from '../state/overlay-effects.js';
import { useAnchoredDropdown } from '../hooks/useAnchoredDropdown.js';
import { Icons } from './Icon.js';
import React from 'react';

export default function PinnedDropdown() {
  const pins = useStore((state) => state.pins);
  const tree = useStore((state) => state.tree);
  const pinnedOpen = useStore((state) => state.ui.pinnedOpen);
  const setPinnedOpen = useStore((state) => state.setPinnedOpen);
  const pinnedShortcut = 'Shift+P';
  const pinnedTooltip = `Pinned pages (${pinnedShortcut})`;

  useOverlayEffects(pinnedOpen, { kind: 'dropdown' });

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useAnchoredDropdown({ open: pinnedOpen, dropdownRef });

  const pinnedNodes = useMemo(() => {
    if (!pins) return [];
    return Array.from(pins.pinned);
  }, [pins, tree]);

  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    if (!pinnedOpen) return;
    setFocusedIndex((prev) => Math.min(prev, Math.max(0, pinnedNodes.length - 1)));
  }, [pinnedOpen, pinnedNodes.length]);

  useEffect(() => {
    if (!pinnedOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          setPinnedOpen(false);
          return;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) =>
            pinnedNodes.length === 0 ? 0 : (prev - 1 + pinnedNodes.length) % pinnedNodes.length,
          );
          return;
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) =>
            pinnedNodes.length === 0 ? 0 : (prev + 1) % pinnedNodes.length,
          );
          return;
        case 'Enter': {
          event.preventDefault();
          const node = pinnedNodes[focusedIndex];
          if (node) void navigateTo(node).finally(() => setPinnedOpen(false));
          return;
        }
        default:
          return;
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (dropdownRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setPinnedOpen(false);
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onMouseDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onMouseDown, true);
    };
  }, [focusedIndex, pinnedNodes, pinnedOpen, setPinnedOpen]);

  const handleNavigate = async (nodeId: NodeId) => {
    const node = tree?.findNodeById(nodeId);
    if (!node) return;
    try {
      await navigateTo(node);
    } catch (error) {
      console.error('PinnedDropdown: navigateTo failed', error);
    } finally {
      setPinnedOpen(false);
    }
  };

  return (
    <div className="pinned-dropdown-wrapper">
      <button
        ref={triggerRef}
        id="pinnedBtn"
        className="matte-circle-btn orb-button"
        type="button"
        aria-label={pinnedTooltip}
        data-tooltip={pinnedTooltip}
        onClick={() => setPinnedOpen(!pinnedOpen)}
      >
        <Icons.Pin size={20} />
      </button>
      <div
        ref={dropdownRef}
        id="pinnedDropdown"
        className={`pinned-dropdown ${pinnedOpen ? '' : 'hidden'}`}
        aria-hidden={!pinnedOpen}
      >
        <div className="pinned-dropdown-header">
          <div className="pinned-dropdown-heading">
            <span className="pinned-dropdown-title">pinned</span>
            <span className="pinned-dropdown-count" id="pinnedCount">
              {pinnedNodes.length}
            </span>
          </div>
          <button
            className="dropdown-close-btn pinned-dropdown-close"
            type="button"
            aria-label="Close pinned list"
            onClick={() => setPinnedOpen(false)}
          >
            <Icons.X size={14} />
          </button>
        </div>
        <div className="pinned-dropdown-list" id="pinnedList">
          {pinnedNodes.length === 0 ? (
            <div className="pinned-dropdown-empty">
              <Icons.Bookmark size={24} />
              <span>No pinned pages yet</span>
              <span className="pinned-dropdown-empty-hint">Right-click a node to pin it</span>
            </div>
          ) : (
            pinnedNodes.map((node, idx) => (
              <div
                key={node.id}
                className={`pinned-dropdown-item ${idx === focusedIndex ? 'focused' : ''}`}
                data-node-id={node.id}
                onClick={() => void handleNavigate(node.id as NodeId)}
                onMouseOver={() => setFocusedIndex(idx)}
              >
                {node.data.url ? (
                  <img className="pinned-dropdown-item-favicon" alt="" src={getFaviconUrl(node.data.url)} />
                ) : (
                  <div className="pinned-dropdown-item-favicon placeholder">
                    <Icons.Pin size={14} />
                  </div>
                )}
                <div className="pinned-dropdown-item-info">
                  <div className="pinned-dropdown-item-title">{node.data.title || 'Untitled'}</div>
                  <div className="pinned-dropdown-item-url">
                    {(() => {
                      try {
                        return new URL(node.data.url).hostname;
                      } catch {
                        return node.data.url || '';
                      }
                    })()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
