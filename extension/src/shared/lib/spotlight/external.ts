const HAS_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const BARE_HOST_RE =
  /^(localhost(?::\d+)?|(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?)(?:[/?#][^\s]*)?$/i;

export function normalizeSpotlightSearchQuery(input: string): string | null {
  const trimmed = input.trim();
  return trimmed ? trimmed : null;
}

export function normalizeSpotlightUrlCandidate(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return null;
  }

  const candidate = HAS_SCHEME_RE.test(trimmed)
    ? trimmed
    : BARE_HOST_RE.test(trimmed)
      ? `https://${trimmed}`
      : null;

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
