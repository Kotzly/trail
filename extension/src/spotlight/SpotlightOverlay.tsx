import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { SuggestionList } from './SuggestionList.js';
import { SpotlightGraphFrame } from './SpotlightGraphFrame.js';
import { navigateToNode, openTree } from './rpc.js';
import type { SpotlightData, SpotlightSuggestion } from './types.js';
import type { NodeId, Url } from '@shared/types/ids.js';

// ─── Animation variants ───

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
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
  hidden: {
    opacity: 0,
    y: 28,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
};

// ─── Component ───

type SpotlightOverlayProps = {
  isOpen: boolean;
  data: SpotlightData | null;
  loading: boolean;
  onClose: () => void;
  themeTokens: Record<string, string> | null;
};

export function SpotlightOverlay({ isOpen, data, loading, onClose, themeTokens }: SpotlightOverlayProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Apply theme CSS custom properties to the Shadow DOM subtree
  useEffect(() => {
    const el = backdropRef.current;
    if (!el || !themeTokens) return;
    for (const [key, value] of Object.entries(themeTokens)) {
      el.style.setProperty(key, value);
    }
    // Derive glass token for panels (muted color at 55% opacity)
    const muted = themeTokens['--muted'];
    if (muted) {
      el.style.setProperty('--spotlight-glass', hexToRgba(muted, 0.55));
    }
  }, [themeTokens]);

  const filteredSuggestions = filterSuggestions(data?.suggestions ?? [], query);

  // Reset selection when query or data changes
  useEffect(() => {
    const firstNonCurrent = filteredSuggestions.findIndex((s) => !s.isCurrent);
    setSelectedIndex(firstNonCurrent >= 0 ? firstNonCurrent : 0);
  }, [query, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus input when opening, reset query when closing
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const selectedSuggestion = filteredSuggestions[selectedIndex] ?? null;

  const handleNavigate = useCallback(
    async (suggestion: SpotlightSuggestion) => {
      if (suggestion.group === 'other-trees' && suggestion.treeId) {
        await openTree(suggestion.treeId);
      } else {
        await navigateToNode(suggestion.nodeId, suggestion.url as Url);
      }
      onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredSuggestions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter': {
          e.preventDefault();
          const item = filteredSuggestions[selectedIndex];
          if (item) void handleNavigate(item);
          break;
        }
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredSuggestions, selectedIndex, handleNavigate, onClose],
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
        {/* Search Bar */}
        <motion.div className="spotlight-search" variants={childVariants}>
          <SearchIcon />
          <input
            ref={inputRef}
            className="spotlight-search-input"
            type="text"
            placeholder="Search pages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </motion.div>

        {/* Panels Row */}
        <motion.div className="spotlight-panels" variants={panelRowVariants}>
          {/* Left: Suggestions */}
          <motion.div className="spotlight-left" variants={childVariants}>
            {loading ? (
              <div className="spotlight-empty">Loading...</div>
            ) : filteredSuggestions.length === 0 ? (
              <div className="spotlight-empty">No results found</div>
            ) : (
              <SuggestionList
                suggestions={filteredSuggestions}
                selectedIndex={selectedIndex}
                onSelect={(index) => setSelectedIndex(index)}
                onActivate={(suggestion) => void handleNavigate(suggestion)}
              />
            )}
          </motion.div>

          {/* Right: Graph */}
          <motion.div className="spotlight-right" variants={childVariants}>
            <SpotlightGraphFrame
              highlightNodeId={selectedSuggestion?.nodeId ?? null}
              onNavigate={(nodeId, url) => {
                void navigateToNode(nodeId, url);
                onClose();
              }}
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ─── Helpers ───

function filterSuggestions(
  items: SpotlightSuggestion[],
  query: string,
): SpotlightSuggestion[] {
  if (!query.trim()) return items;
  const tokens = query.toLowerCase().trim().split(/\s+/);
  return items.filter((item) => {
    const haystack = `${item.title} ${item.url}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
