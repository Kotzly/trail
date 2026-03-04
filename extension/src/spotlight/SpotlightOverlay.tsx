import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SuggestionList } from './SuggestionList.js';
import { SpotlightGraphFrame } from './SpotlightGraphFrame.js';
import { navigateToNode, openTree } from './rpc.js';
import type { SpotlightData, SpotlightSuggestion } from './types.js';
import type { NodeId, Url } from '@shared/types/ids.js';

type SpotlightOverlayProps = {
  data: SpotlightData | null;
  loading: boolean;
  onClose: () => void;
};

export function SpotlightOverlay({ data, loading, onClose }: SpotlightOverlayProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on query
  const filteredSuggestions = filterSuggestions(data?.suggestions ?? [], query);

  // Reset selection when query or data changes
  useEffect(() => {
    // Default: select first non-current item
    const firstNonCurrent = filteredSuggestions.findIndex((s) => !s.isCurrent);
    setSelectedIndex(firstNonCurrent >= 0 ? firstNonCurrent : 0);
  }, [query, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus search input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const selectedSuggestion = filteredSuggestions[selectedIndex] ?? null;

  const handleClose = useCallback(() => {
    setVisible(false);
    // Wait for exit animation before unmounting
    setTimeout(onClose, 200);
  }, [onClose]);

  const handleNavigate = useCallback(
    async (suggestion: SpotlightSuggestion) => {
      if (suggestion.group === 'other-trees' && suggestion.treeId) {
        await openTree(suggestion.treeId);
      } else {
        await navigateToNode(suggestion.nodeId, suggestion.url as Url);
      }
      handleClose();
    },
    [handleClose],
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
          handleClose();
          break;
      }
    },
    [filteredSuggestions, selectedIndex, handleNavigate, handleClose],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose],
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="spotlight-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleBackdropClick}
          onKeyDown={handleKeyDown}
        >
          <motion.div
            className="spotlight-modal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Left Panel */}
            <div className="spotlight-left">
              <div className="spotlight-search">
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
              </div>
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
            </div>

            {/* Right Panel */}
            <div className="spotlight-right">
              <SpotlightGraphFrame
                highlightNodeId={selectedSuggestion?.nodeId ?? null}
                onNavigate={(nodeId, url) => {
                  void navigateToNode(nodeId, url);
                  handleClose();
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
