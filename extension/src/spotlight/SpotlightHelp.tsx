export function SpotlightHelp({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div className="spotlight-help" role="dialog" aria-label="Spotlight help">
      <div className="spotlight-help-title">Search syntax</div>
      <div className="spotlight-help-list">
        <div className="spotlight-help-item"><code>github issues</code><span>search</span></div>
        <div className="spotlight-help-item"><code>"foo bar"</code><span>exact phrase</span></div>
        <div className="spotlight-help-item"><code>-docs</code><span>exclude</span></div>
        <div className="spotlight-help-item"><code>foo | bar</code><span>OR</span></div>
        <div className="spotlight-help-item"><code>&gt; export tree</code><span>commands</span></div>
      </div>
      <div className="spotlight-help-title">Filters</div>
      <div className="spotlight-help-list">
        <div className="spotlight-help-item"><code>domain:github.com</code><span>by domain</span></div>
        <div className="spotlight-help-item"><code>tab:open</code><span>open tabs only</span></div>
        <div className="spotlight-help-item"><code>tab:closed</code><span>closed tabs only</span></div>
        <div className="spotlight-help-item"><code>tree:current</code><span>current tree</span></div>
        <div className="spotlight-help-item"><code>tree:other</code><span>other trees</span></div>
        <div className="spotlight-help-item"><code>tree:any</code><span>all trees</span></div>
        <div className="spotlight-help-item"><code>group:open-tabs</code><span>open tab group</span></div>
        <div className="spotlight-help-item"><code>is:current</code><span>active page</span></div>
      </div>
      <div className="spotlight-help-hint">Press <kbd>?</kbd> to toggle help &middot; <kbd>Tab</kbd> to accept hint</div>
    </div>
  );
}
