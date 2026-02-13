export const ALLOWED_SITE_ORIGINS = [
  'https://gettrail.net',
  'https://app.gettrail.net',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
] as const;

export const ALLOWED_SITE_MATCH_PATTERNS = [
  'https://gettrail.net/*',
  'https://app.gettrail.net/*',
  'http://localhost:3000/*',
  'http://localhost:3001/*',
  'http://127.0.0.1:3000/*',
  'http://127.0.0.1:3001/*',
] as const;

export const OPTIONAL_HOST_MATCH_PATTERNS = ['<all_urls>'] as const;

const allowedSiteOriginsSet = new Set<string>(ALLOWED_SITE_ORIGINS);

export function isAllowedSiteOrigin(origin: string): boolean {
  return allowedSiteOriginsSet.has(origin);
}
