const ALLOWED_SITE_ORIGINS = new Set<string>([
  'https://gettrail.net',
  'https://app.gettrail.net',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  // edit in content-script too if you're gonna edit that
]);

export function isAllowedSiteOrigin(origin: string): boolean {
  return ALLOWED_SITE_ORIGINS.has(origin);
}
