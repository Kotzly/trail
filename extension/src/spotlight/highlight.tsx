import type { ReactNode } from 'react';
import type { SpotlightHighlightRange } from './types.js';

export function highlightText(text: string, ranges: SpotlightHighlightRange[]): ReactNode {
  if (!ranges.length) return text;

  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const { start, end } of ranges) {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={start} className="spotlight-highlight">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
