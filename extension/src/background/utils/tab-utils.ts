import type { Url } from '@shared/types/ids.js';
import { shouldTrackUrl } from './url-utils.js';
import { type Tab } from '@shared/platform/webext.js';

export function resolveTabUrl(tab: Tab): Url | null {
  const urlCandidate = tab.url ?? null;
  const pendingCandidate = tab.pendingUrl ?? null;

  if (urlCandidate && shouldTrackUrl(urlCandidate as Url)) {
    return urlCandidate as Url;
  }

  if (pendingCandidate && shouldTrackUrl(pendingCandidate as Url)) {
    return pendingCandidate as Url;
  }

  return (urlCandidate ?? pendingCandidate) as Url | null;
}
