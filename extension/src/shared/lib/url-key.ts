import type { Url } from '../types/ids.js';

const DEFAULT_PORTS: Record<string, string> = {
  'http:': '80',
  'https:': '443',
};

function shouldDropParam(name: string): boolean {
  const key = name.toLowerCase();
  if (key.startsWith('utm_')) return true;
  return (
    key === 'gclid' ||
    key === 'fbclid' ||
    key === 'igshid' ||
    key === 'msclkid' ||
    key === 'yclid' ||
    key === 'mc_cid' ||
    key === 'mc_eid' ||
    key === 'ref' ||
    key === 'ref_src' ||
    key === 'ref_url'
  );
}

function stripTrailingSlash(path: string): string {
  if (!path || path === '/') return '/';
  return path.replace(/\/+$/, '');
}

function buildQueryKey(searchParams: URLSearchParams): string {
  const entries: Array<[string, string]> = [];
  searchParams.forEach((value, key) => {
    if (shouldDropParam(key)) return;
    entries.push([key, value]);
  });
  if (entries.length === 0) return '';
  entries.sort((a, b) => {
    if (a[0] !== b[0]) return a[0].localeCompare(b[0]);
    return a[1].localeCompare(b[1]);
  });
  return entries.map(([key, value]) => `${key}=${value}`).join('&');
}

export function createUrlKey(raw: Url | string | null | undefined): string {
  const candidate = typeof raw === 'string' ? raw.trim() : '';
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    url.hash = '';

    if (url.host && DEFAULT_PORTS[url.protocol] && url.port === DEFAULT_PORTS[url.protocol]) {
      url.port = '';
    }

    const pathname = stripTrailingSlash(url.pathname || '/');
    const host = url.host.toLowerCase();
    const query = buildQueryKey(url.searchParams);
    const search = query ? `?${query}` : '';
    return `${url.protocol}//${host}${pathname}${search}`;
  } catch {
    const noHash = candidate.split('#')[0] ?? '';
    const stripped = noHash.endsWith('/') ? noHash.replace(/\/+$/, '') : noHash;
    const normalized = stripped || '/';
    return normalized.toLowerCase();
  }
}
