import { useCallback, useSyncExternalStore } from 'react';
import type { ComponentType } from 'react';

export type RouteParams = {
  params: Record<string, string>;
};

export type RouteDefinition = {
  path: string;
  pattern: RegExp;
  paramNames: string[];
  component: ComponentType<RouteParams>;
};

export function defineRoute(
  path: string,
  component: ComponentType<RouteParams>,
): RouteDefinition {
  const paramNames: string[] = [];
  const patternStr = path.replace(/:([^/]+)/g, (_match, name: string) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  return {
    path,
    pattern: new RegExp(`^${patternStr}$`),
    paramNames,
    component,
  };
}

export type MatchResult = {
  route: RouteDefinition;
  params: Record<string, string>;
};

export function matchRoute(
  hash: string,
  routes: readonly RouteDefinition[],
): MatchResult | null {
  const path = hash.startsWith('#') ? hash.slice(1) : hash;
  const normalized = path || '/';

  for (const route of routes) {
    const match = normalized.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        const value = match[i + 1];
        if (value !== undefined) {
          params[name] = decodeURIComponent(value);
        }
      });
      return { route, params };
    }
  }
  return null;
}

function getHash(): string {
  return window.location.hash;
}

function subscribeHash(onStoreChange: () => void): () => void {
  window.addEventListener('hashchange', onStoreChange);
  return () => window.removeEventListener('hashchange', onStoreChange);
}

export function useRoute(
  routes: readonly RouteDefinition[],
): MatchResult | null {
  const hash = useSyncExternalStore(subscribeHash, getHash, getHash);
  return matchRoute(hash, routes);
}

export function useCurrentPath(): string {
  const hash = useSyncExternalStore(subscribeHash, getHash, getHash);
  return hash.startsWith('#') ? hash.slice(1) : '/';
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function useNavigate(): (path: string) => void {
  return useCallback((path: string) => navigate(path), []);
}
