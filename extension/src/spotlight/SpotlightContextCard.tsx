import type { SpotlightSearchResult } from './types.js';

export function SpotlightContextCard({ item }: { item: SpotlightSearchResult | null }) {
  if (!item) {
    return (
      <div className="spotlight-context-card">
        <div className="spotlight-context-title">Graph</div>
        <div className="spotlight-context-body">Select a result to inspect context and actions.</div>
      </div>
    );
  }

  if (item.kind === 'action') {
    return (
      <div className="spotlight-context-card">
        <div className="spotlight-context-eyebrow">Action</div>
        <div className="spotlight-context-title">{item.title}</div>
        <div className="spotlight-context-body">{item.subtitle}</div>
        <div className="spotlight-context-meta">{item.shortcutHint} • {item.safety === 'destructive' ? 'Destructive' : 'Safe'}</div>
      </div>
    );
  }

  if (item.kind === 'tree') {
    return (
      <div className="spotlight-context-card">
        <div className="spotlight-context-eyebrow">Archived Tree</div>
        <div className="spotlight-context-title">{item.treeName}</div>
        <div className="spotlight-context-body">{item.rootUrl || 'No root URL available'}</div>
        <div className="spotlight-context-chips">
          {item.why.map((why) => <span key={why} className="spotlight-context-chip">{why}</span>)}
        </div>
      </div>
    );
  }

  return (
    <div className="spotlight-context-card">
      <div className="spotlight-context-eyebrow">{item.groupBadge}</div>
      <div className="spotlight-context-title">{item.title}</div>
      <div className="spotlight-context-body">{item.url}</div>
      <div className="spotlight-context-meta">
        {item.treeRelation} • {item.tabCount > 0 ? `${item.tabCount} open` : 'closed'}
      </div>
      <div className="spotlight-context-chips">
        {item.why.map((why) => <span key={why} className="spotlight-context-chip">{why}</span>)}
      </div>
    </div>
  );
}
