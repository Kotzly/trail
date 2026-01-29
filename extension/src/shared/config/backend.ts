export type BackendEnvironment = 'production' | 'staging' | 'local';

export const BACKEND_CONFIG = {
  env: 'production' as BackendEnvironment,
  baseUrl: 'https://app.gettrail.net',
  basePath: '/v1',
  portalUrl: 'https://app.gettrail.net/extension',
  timeoutMs: 10000,
  endpoints: {
    authPortal: '/auth/portal',
    logout: '/auth/logout',
    account: '/account',
    plans: '/plans',
    subscription: '/subscription',
    billing: '/billing',
    checkout: '/subscription/checkout',
    billingPortal: '/billing/portal',
  },
  openApiPath: 'api/openapi.yml',
} as const;

export type BackendConfig = typeof BACKEND_CONFIG;

export function buildBackendUrl(path: string): string {
  const base = `${BACKEND_CONFIG.baseUrl}${BACKEND_CONFIG.basePath}`;
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}
