import type { SpotlightActionResult, SpotlightSearchResult } from './types.js';

type SpotlightFooterProps = {
  selectedItem: SpotlightSearchResult | null;
  statusText: string | null;
};

export function SpotlightFooter({ selectedItem, statusText }: SpotlightFooterProps) {
  return (
    <div className="spotlight-footer">
      <div className="spotlight-footer-left">
        {statusText ? <span className="spotlight-status">{statusText}</span> : <span>Enter open, Alt+Enter destructive, ? help</span>}
      </div>
      <div className="spotlight-footer-right">
        {selectedItem?.kind === 'action' ? (
          <span>{selectedItem.shortcutHint}</span>
        ) : selectedItem ? (
          <span>{selectedLabel(selectedItem)}</span>
        ) : (
          <span>No selection</span>
        )}
      </div>
    </div>
  );
}

function selectedLabel(item: SpotlightSearchResult): string {
  if (item.kind === 'node') return item.title;
  if (item.kind === 'tree') return item.treeName;
  return item.title;
}

export function isDestructiveAction(item: SpotlightSearchResult | null): item is SpotlightActionResult {
  return Boolean(item && item.kind === 'action' && item.safety === 'destructive');
}
