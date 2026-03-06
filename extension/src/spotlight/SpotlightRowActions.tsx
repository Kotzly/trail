import type { SpotlightActionId, SpotlightActionTarget, SpotlightSearchResult } from './types.js';

type Props = {
  item: SpotlightSearchResult;
  activeTreeId: string | null;
  onAction: (actionId: SpotlightActionId, target: SpotlightActionTarget, statusText: string) => void;
};

export function SpotlightRowActions({ item, activeTreeId, onAction }: Props) {
  if (item.kind === 'action') return null;

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const fire = (e: React.MouseEvent, actionId: SpotlightActionId, target: SpotlightActionTarget, status: string) => {
    stop(e);
    onAction(actionId, target, status);
  };

  if (item.kind === 'tree') {
    return (
      <div className="spotlight-row-actions">
        <button
          type="button"
          className="spotlight-row-action-btn"
          title="Export tree"
          onClick={(e) => fire(e, 'export-tree', { kind: 'tree', treeId: item.treeId }, 'Exported')}
        >
          <ExportIcon />
        </button>
      </div>
    );
  }

  const isForeign = activeTreeId !== null && item.treeId !== activeTreeId;

  return (
    <div className="spotlight-row-actions">
      <button
        type="button"
        className="spotlight-row-action-btn"
        title="Copy URL"
        onClick={(e) => {
          stop(e);
          void navigator.clipboard.writeText(item.url).then(
            () => onAction('copy-url', { kind: 'node', nodeId: item.nodeId, treeId: item.treeId }, 'URL copied'),
            () => onAction('copy-url', { kind: 'node', nodeId: item.nodeId, treeId: item.treeId }, 'Clipboard unavailable'),
          );
        }}
      >
        <CopyIcon />
      </button>
      {!isForeign && (
        <button
          type="button"
          className="spotlight-row-action-btn"
          title={item.pinned ? 'Unpin' : 'Pin'}
          onClick={(e) =>
            fire(
              e,
              item.pinned ? 'unpin' : 'pin',
              { kind: 'node', nodeId: item.nodeId, treeId: item.treeId },
              item.pinned ? 'Unpinned' : 'Pinned',
            )
          }
        >
          <PinIcon filled={item.pinned} />
        </button>
      )}
      {!isForeign && item.tabCount > 0 && (
        <button
          type="button"
          className="spotlight-row-action-btn spotlight-row-action-btn--destructive"
          title="Close tab"
          onClick={(e) =>
            fire(
              e,
              item.tabCount > 1 ? 'close-tabs' : 'close-tab',
              { kind: 'node', nodeId: item.nodeId, treeId: item.treeId },
              'Tab closed',
            )
          }
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
      <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
    </svg>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.456.734a1.75 1.75 0 012.826.504l.613 1.327a3.1 3.1 0 002.084 1.707l2.451.484a1.75 1.75 0 01.757 3.031l-1.687 1.42a3.1 3.1 0 00-.998 2.497l.07 2.032a1.75 1.75 0 01-2.733 1.527L6.2 12.4a3.1 3.1 0 00-2.398-.564L1.37 12.2a1.75 1.75 0 01-1.816-2.46l.881-2.063a3.1 3.1 0 00.124-2.149L.1 3.636A1.75 1.75 0 011.87 1.418l2.586-.684z" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4.456.734a1.75 1.75 0 012.826.504l.613 1.327a3.1 3.1 0 002.084 1.707l2.451.484a1.75 1.75 0 01.757 3.031l-1.687 1.42a3.1 3.1 0 00-.998 2.497l.07 2.032a1.75 1.75 0 01-2.733 1.527L6.2 12.4a3.1 3.1 0 00-2.398-.564L1.37 12.2a1.75 1.75 0 01-1.816-2.46l.881-2.063a3.1 3.1 0 00.124-2.149L.1 3.636A1.75 1.75 0 011.87 1.418l2.586-.684z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2.75 14A1.75 1.75 0 011 12.25v-2.5a.75.75 0 011.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25v-2.5a.75.75 0 011.5 0v2.5A1.75 1.75 0 0113.25 14H2.75z" />
      <path d="M11.78 4.72a.75.75 0 00-1.06-1.06L8.75 5.63V1a.75.75 0 00-1.5 0v4.63L5.28 3.66a.75.75 0 00-1.06 1.06l3.25 3.25a.75.75 0 001.06 0l3.25-3.25z" />
    </svg>
  );
}
