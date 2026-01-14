export type BackendEnvironment = 'production' | 'staging' | 'local';

export const BACKEND_CONFIG = {
  env: 'production' as BackendEnvironment,
  baseUrl: 'https://api.trail.app',
  basePath: '/v1',
  timeoutMs: 10000,
  endpoints: {
    login: '/auth/login',
    logout: '/auth/logout',
    account: '/account',
    plans: '/plans',
    subscription: '/subscription',
    billing: '/billing',
  },
  openApiPath: 'api/openapi.yml',
} as const;

export type BackendConfig = typeof BACKEND_CONFIG;

export function buildBackendUrl(path: string): string {
  const base = `${BACKEND_CONFIG.baseUrl}${BACKEND_CONFIG.basePath}`;
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}
