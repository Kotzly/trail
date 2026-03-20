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
        onClick={() => onAction("bookmarks:")}
      >
        Bookmarks
      </button>
      <button type="button" className="newtab-quick-action-btn" onClick={() => onAction("trees:")}>
        Trails
      </button>
      <button
        type="button"
        className="newtab-quick-action-btn"
        onClick={() => onAction(">settings")}
      >
        Settings
      </button>
    </div>
  );
}
