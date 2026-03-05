export function SpotlightHelp({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div className="spotlight-help" role="dialog" aria-label="Spotlight help">
      <div className="spotlight-help-title">Search help</div>
      <div className="spotlight-help-grid">
        <div><code>github issues</code><span>basic search</span></div>
        <div><code>"foo bar"</code><span>exact phrase</span></div>
        <div><code>-docs</code><span>negation</span></div>
        <div><code>domain:github.com</code><span>filter by domain</span></div>
        <div><code>tab:open tree:current</code><span>filter by state</span></div>
        <div><code>foo | bar</code><span>OR clause</span></div>
        <div><code>&gt; export tree</code><span>command mode</span></div>
      </div>
    </div>
  );
}
