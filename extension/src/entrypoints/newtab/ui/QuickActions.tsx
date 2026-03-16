// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuickActionsProps = {
  readonly onAction: (filter: string) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="newtab-quick-actions">
      <button
        type="button"
        className="newtab-quick-action-btn"
        onClick={() => onAction('bookmarks:')}
      >
        <kbd className="newtab-quick-action-kbd">1</kbd> Bookmarks
      </button>
      <button
        type="button"
        className="newtab-quick-action-btn"
        onClick={() => onAction('trees:')}
      >
        <kbd className="newtab-quick-action-kbd">2</kbd> Trails
      </button>
      <button
        type="button"
        className="newtab-quick-action-btn"
        onClick={() => onAction('>settings')}
      >
        <kbd className="newtab-quick-action-kbd">3</kbd> Settings
      </button>
    </div>
  );
}
