import type { SpotlightMode } from './types.js';

type SpotlightFooterProps = {
  mode: SpotlightMode;
  isMultiSelect: boolean;
  focusPane: 'list' | 'graph';
};

export function SpotlightFooter({ mode, isMultiSelect, focusPane }: SpotlightFooterProps) {
  return (
    <div className="spotlight-footer">
      <div className="spotlight-footer-hints">
        <span className="spotlight-footer-hint">
          <kbd className="spotlight-footer-kbd">{'\u2191\u2193'}</kbd>
          <span className="spotlight-footer-label">navigate</span>
        </span>
        <span className="spotlight-footer-hint">
          <kbd className="spotlight-footer-kbd">{'\u23CE'}</kbd>
          <span className="spotlight-footer-label">open</span>
        </span>
        <span className="spotlight-footer-hint">
          <kbd className="spotlight-footer-kbd">Tab</kbd>
          <span className="spotlight-footer-label">{focusPane === 'list' ? 'graph' : 'list'}</span>
        </span>
        {!isMultiSelect && (
          <span className="spotlight-footer-hint">
            <kbd className="spotlight-footer-kbd">{'\u21E7'}Tab</kbd>
            <span className="spotlight-footer-label">select</span>
          </span>
        )}
        <span className="spotlight-footer-hint">
          <kbd className="spotlight-footer-kbd">?</kbd>
          <span className="spotlight-footer-label">help</span>
        </span>
      </div>
      {mode !== 'commands' && (
        <div className="spotlight-footer-hints">
          <span className="spotlight-footer-hint">
            <kbd className="spotlight-footer-kbd">&gt;</kbd>
            <span className="spotlight-footer-label">commands</span>
          </span>
        </div>
      )}
    </div>
  );
}
