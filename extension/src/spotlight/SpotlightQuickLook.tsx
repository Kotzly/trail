import { useEffect } from 'react';
import type {
  SpotlightActionId,
  SpotlightActionTarget,
  SpotlightNodeResult,
  SpotlightTreeResult,
} from './types.js';

type QuickLookItem = SpotlightNodeResult | SpotlightTreeResult;

type Props = {
  item: QuickLookItem;
  onClose: () => void;
  onAction: (actionId: SpotlightActionId, target: SpotlightActionTarget, statusText: string) => void;
};

export function SpotlightQuickLook({ item, onClose, onAction }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          if (item.kind === 'node') {
            onAction('open', { kind: 'node', nodeId: item.nodeId, treeId: item.treeId }, 'Opened');
          } else {
            onAction('open-tree', { kind: 'tree', treeId: item.treeId }, 'Opened');
          }
          return;
        case 'c':
          if (!e.metaKey && !e.ctrlKey && item.kind === 'node') {
            e.preventDefault();
            e.stopPropagation();
            void navigator.clipboard.writeText(item.url).then(
              () => onAction('copy-url', { kind: 'node', nodeId: item.nodeId, treeId: item.treeId }, 'URL copied'),
              () => {},
            );
          }
          return;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [item, onClose, onAction]);

  const domain = item.kind === 'node'
    ? extractDomain(item.url)
    : extractDomain(item.rootUrl);
  const url = item.kind === 'node' ? item.url : item.rootUrl;

  return (
    <div className="spotlight-quicklook-overlay" onClick={onClose}>
      <div className="spotlight-quicklook" onClick={(e) => e.stopPropagation()}>
        <div className="spotlight-quicklook-header">
          <div className="spotlight-quicklook-domain-row">
            {item.favicon && (
              <img
                className="spotlight-quicklook-favicon"
                src={item.favicon}
                alt=""
                width={16}
                height={16}
              />
            )}
            <span className="spotlight-quicklook-domain">{domain}</span>
          </div>
          <button type="button" className="spotlight-quicklook-close" onClick={onClose}>
            Esc
          </button>
        </div>

        <div className="spotlight-quicklook-hero">
          <div className="spotlight-quicklook-hero-icon">{domain[0]?.toUpperCase() ?? '?'}</div>
        </div>

        <div className="spotlight-quicklook-info">
          <div className="spotlight-quicklook-title">{item.kind === 'node' ? item.title : item.treeName}</div>
          <div className="spotlight-quicklook-url">{url}</div>
        </div>

        <div className="spotlight-quicklook-meta">
          {item.kind === 'node' && (
            <>
              <span className="spotlight-quicklook-chip">{item.groupBadge}</span>
              <span className="spotlight-quicklook-chip">{item.treeName}</span>
              {item.pinned && <span className="spotlight-quicklook-chip spotlight-quicklook-chip--accent">Pinned</span>}
              {item.tabCount > 0 && <span className="spotlight-quicklook-chip">{item.tabCount} tab{item.tabCount > 1 ? 's' : ''}</span>}
            </>
          )}
          {item.kind === 'tree' && (
            <span className="spotlight-quicklook-chip">{item.groupBadge}</span>
          )}
          <span className="spotlight-quicklook-chip">{formatRecency(item.recency)}</span>
        </div>

        <div className="spotlight-quicklook-actions">
          <button
            type="button"
            className="spotlight-quicklook-btn"
            onClick={() => {
              if (item.kind === 'node') {
                onAction('open', { kind: 'node', nodeId: item.nodeId, treeId: item.treeId }, 'Opened');
              } else {
                onAction('open-tree', { kind: 'tree', treeId: item.treeId }, 'Opened');
              }
            }}
          >
            Open <kbd>Enter</kbd>
          </button>
          {item.kind === 'node' && (
            <button
              type="button"
              className="spotlight-quicklook-btn"
              onClick={() => {
                void navigator.clipboard.writeText(item.url).then(
                  () => onAction('copy-url', { kind: 'node', nodeId: item.nodeId, treeId: item.treeId }, 'URL copied'),
                  () => {},
                );
              }}
            >
              Copy URL <kbd>C</kbd>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function formatRecency(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}
