import type { Url } from '../../shared/types/ids.js';
import { isPlaceholderUrl } from './url-utils.js';

export function resolveTabUrl(tab: chrome.tabs.Tab): Url | null {
  const urlCandidate = tab.url ?? null;
  const pendingCandidate = tab.pendingUrl ?? null;

  if (urlCandidate && !isPlaceholderUrl(urlCandidate as Url)) {
    return urlCandidate as Url;
  }

  if (pendingCandidate && !isPlaceholderUrl(pendingCandidate as Url)) {
    return pendingCandidate as Url;
  }

  return (urlCandidate ?? pendingCandidate) as Url | null;
}
