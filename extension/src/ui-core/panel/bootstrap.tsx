import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import App from "@entrypoints/sidepanel/ui/App.js";
import ErrorBoundary from "@entrypoints/sidepanel/ui/components/ErrorBoundary.js";
import { initBackendConfig } from "@shared/config/backend.js";
import { queryClient } from "@entrypoints/sidepanel/ui/query/client.js";
import { browser } from "@shared/platform/webext.js";
import type { CachedLayoutResult } from "@shared/graph-layout-cache/types.js";

declare global {
  var __trailCachedLayout: CachedLayoutResult | null | undefined;
}

export type MountPanelAppOptions = {
  rootId?: string;
  connectPortName?: string;
  cachedLayout?: CachedLayoutResult | null;
};

export function mountPanelApp(options: MountPanelAppOptions = {}): void {
  const { rootId = "root", connectPortName, cachedLayout } = options;

  if (connectPortName) {
    browser.runtime.connect({ name: connectPortName });
  }

  // Stash pre-fetched layout for GraphCanvas consumption
  if (cachedLayout !== undefined) {
    globalThis.__trailCachedLayout = cachedLayout;
  }

  const rootEl = document.getElementById(rootId);
  if (!rootEl) {
    throw new Error(`Missing #${rootId} element`);
  }

  void initBackendConfig();

  createRoot(rootEl).render(
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>,
  );
}
