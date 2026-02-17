const PRODUCTION_ORIGINS: readonly string[] = [
  'https://gettrail.net',
  'https://app.gettrail.net',
];

const DEV_ORIGINS: readonly string[] = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

const PRODUCTION_MATCH_PATTERNS: readonly string[] = [
  'https://gettrail.net/*',
  'https://app.gettrail.net/*',
];

const DEV_MATCH_PATTERNS: readonly string[] = [
  'http://localhost/*',
  'http://127.0.0.1/*',
];

const isDev = process.env.NODE_ENV !== 'production';

export const ALLOWED_SITE_ORIGINS: readonly string[] = isDev
  ? [...PRODUCTION_ORIGINS, ...DEV_ORIGINS]
  : [...PRODUCTION_ORIGINS];

export const ALLOWED_SITE_MATCH_PATTERNS: readonly string[] = isDev
  ? [...PRODUCTION_MATCH_PATTERNS, ...DEV_MATCH_PATTERNS]
  : [...PRODUCTION_MATCH_PATTERNS];

const allowedSiteOriginsSet = new Set<string>(ALLOWED_SITE_ORIGINS);

export function isAllowedSiteOrigin(origin: string): boolean {
  return allowedSiteOriginsSet.has(origin);
}
