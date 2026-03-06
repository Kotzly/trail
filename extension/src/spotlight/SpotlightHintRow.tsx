export function computeGhostSuffix(query: string, activeHint: string | null): string {
  if (!activeHint) return '';
  const trimmed = query.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('>') && activeHint.startsWith('>')) {
    return activeHint.slice(trimmed.length);
  }

  const parts = query.split(/\s+/);
  const last = parts[parts.length - 1] ?? '';
  if (!last) return '';

  if (activeHint.toLowerCase().startsWith(last.toLowerCase())) {
    return activeHint.slice(last.length);
  }
  return '';
}

export function buildSpotlightHints(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return ['domain:', 'tab:open', 'tab:closed', 'tree:current', 'tree:other', 'group:open-tabs', 'is:current', '|', '>'];
  }

  if (trimmed.startsWith('>')) {
    return ['> new tree', '> archive tree', '> export tree', '> pin current page'];
  }

  const parts = query.split(/\s+/);
  const last = parts[parts.length - 1] ?? '';
  if (!last) return [];

  if ('domain:'.startsWith(last)) return ['domain:'];
  if (last.startsWith('tab:')) return ['tab:open', 'tab:closed'];
  if (last.startsWith('tree:')) return ['tree:current', 'tree:other', 'tree:any'];
  if (last.startsWith('group:')) return ['group:open-tabs', 'group:recently-closed', 'group:current-tree', 'group:other-trees'];
  if (last.startsWith('is:')) return ['is:current'];
  if (last === '|') return ['|'];
  if ('do'.startsWith(last.toLowerCase()) || 'domain'.startsWith(last.toLowerCase())) return ['domain:'];
  return [];
}

export function shouldApplyHintOnTab(query: string, hints: string[]): boolean {
  if (hints.length === 0) return false;
  const trimmed = query.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('>')) return true;
  const parts = query.split(/\s+/);
  const last = parts[parts.length - 1] ?? '';
  return last.includes(':') || last.length <= 3;
}

export function applySpotlightHint(query: string, hint: string): string {
  const trimmed = query.trim();
  if (!trimmed) return hint.endsWith(':') ? hint : `${hint} `;
  if (trimmed.startsWith('>')) return hint;

  const parts = query.split(/\s+/);
  parts[parts.length - 1] = hint;
  return `${parts.join(' ')}${hint.endsWith(':') ? '' : ' '}`;
}
