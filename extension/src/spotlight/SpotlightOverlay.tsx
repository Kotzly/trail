import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { SuggestionList } from './SuggestionList.js';
import { SpotlightGraphFrame } from './SpotlightGraphFrame.js';
import { navigateToNode } from './rpc.js';
import type { SpotlightSearchResult } from './types.js';
import type { NodeId, Url } from '@shared/types/ids.js';

const backdropVariants = {
  visible: { opacity: 1 },
  hidden: { opacity: 0 },
};

const containerVariants = {
  visible: { transition: { staggerChildren: 0.06 } },
  hidden: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
};

const panelRowVariants = {
  visible: { transition: { staggerChildren: 0.06 } },
  hidden: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
};

const childVariants = {
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  },
  hidden: {
    opacity: 0,
    y: 28,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const },
  },
};

type SpotlightOverlayProps = {
  isOpen: boolean;
  suggestions: SpotlightSearchResult[];
  query: string;
  loading: boolean;
  onQueryChange: (query: string) => void;
  onActivate: (suggestion: SpotlightSearchResult) => Promise<void>;
  onClose: () => void;
  themeTokens: Record<string, string> | null;
};

export function SpotlightOverlay({
  isOpen,
  suggestions,
  query,
  loading,
  onQueryChange,
  onActivate,
  onClose,
  themeTokens,
}: SpotlightOverlayProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredGraphNodeId, setHoveredGraphNodeId] = useState<NodeId | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = backdropRef.current;
    if (!el || !themeTokens) return;
    for (const [key, value] of Object.entries(themeTokens)) {
      el.style.setProperty(key, value);
    }
  }, [themeTokens]);

  useEffect(() => {
    const firstNonCurrent = suggestions.findIndex((s) => !s.isCurrent);
    setSelectedIndex(firstNonCurrent >= 0 ? firstNonCurrent : 0);
    setHoveredGraphNodeId(null);
  }, [query, suggestions]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setHoveredGraphNodeId(null);
    }
  }, [isOpen]);

  const selectedSuggestion = suggestions[selectedIndex] ?? null;
  const highlightedNodeId =
    selectedSuggestion && selectedSuggestion.group !== 'other-trees' ? selectedSuggestion.nodeId : null;

  const hoveredSuggestionIndex =
    hoveredGraphNodeId === null
      ? -1
      : suggestions.findIndex(
          (suggestion) =>
            suggestion.group !== 'other-trees' && suggestion.nodeId === hoveredGraphNodeId,
        );
  const displaySelectedIndex = hoveredSuggestionIndex >= 0 ? hoveredSuggestionIndex : selectedIndex;

  const handleGraphNavigate = useCallback(
    (nodeId: NodeId, url: Url) => {
      void navigateToNode(nodeId, url);
      onClose();
    },
    [onClose],
  );

  const handleGraphHover = useCallback((nodeId: NodeId | null) => {
    setHoveredGraphNodeId(nodeId);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHoveredGraphNodeId(null);
          setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHoveredGraphNodeId(null);
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter': {
          e.preventDefault();
          const item = suggestions[selectedIndex];
          if (item) void onActivate(item);
          break;
        }
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [suggestions, selectedIndex, onActivate, onClose],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <motion.div
      ref={backdropRef}
      className="spotlight-backdrop"
      animate={isOpen ? 'visible' : 'hidden'}
      initial="hidden"
      variants={backdropVariants}
      transition={{ duration: 0.15 }}
      style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <motion.div className="spotlight-container" variants={containerVariants}>
        <motion.div className="spotlight-search" variants={childVariants}>
          <SearchIcon />
          <input
            ref={inputRef}
            className="spotlight-search-input"
            type="text"
            placeholder="Search pages..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </motion.div>

        <motion.div className="spotlight-panels" variants={panelRowVariants}>
          <motion.div className="spotlight-left" variants={childVariants}>
            {loading ? (
              <div className="spotlight-empty">Loading...</div>
            ) : suggestions.length === 0 ? (
              <div className="spotlight-empty">No results found</div>
            ) : (
              <SuggestionList
                suggestions={suggestions}
                selectedIndex={displaySelectedIndex}
                onSelect={(index) => {
                  setHoveredGraphNodeId(null);
                  setSelectedIndex(index);
                }}
                onActivate={(suggestion) => void onActivate(suggestion)}
              />
            )}
          </motion.div>

          <motion.div className="spotlight-right" variants={childVariants}>
            <SpotlightGraphFrame
              highlightNodeId={highlightedNodeId}
              onNavigate={handleGraphNavigate}
              onHoverNode={handleGraphHover}
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="spotlight-search-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
