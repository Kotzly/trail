import type { Url } from '../../shared/types/ids.js';
import { isBlankUrl, shouldTrackUrl } from './url-utils.js';

export function resolveTabUrl(tab: chrome.tabs.Tab): Url | null {
  const urlCandidate = tab.url ?? null;
  const pendingCandidate = tab.pendingUrl ?? null;

  if (urlCandidate && shouldTrackUrl(urlCandidate as Url) && !isBlankUrl(urlCandidate as Url)) {
    return urlCandidate as Url;
  }

  if (pendingCandidate && shouldTrackUrl(pendingCandidate as Url) && !isBlankUrl(pendingCandidate as Url)) {
    return pendingCandidate as Url;
  }

  return (urlCandidate ?? pendingCandidate) as Url | null;
}
