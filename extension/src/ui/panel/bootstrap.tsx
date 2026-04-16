import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import App from "@apps/sidepanel/ui/App.js";
import ErrorBoundary from "@apps/sidepanel/ui/components/ErrorBoundary.js";
import { initBackendConfig } from "@shared/config/backend.js";
import { queryClient } from "@ui/query/client.js";
import { ThemeProvider } from "@ui/providers/theme-provider.js";
import { browser } from "@shared/platform/webext.js";

export type MountPanelAppOptions = {
  rootId?: string;
  connectPortName?: string;
};

export function mountPanelApp(options: MountPanelAppOptions = {}): void {
  const { rootId = "root", connectPortName } = options;

  if (connectPortName) {
    browser.runtime.connect({ name: connectPortName });
  }

  const rootEl = document.getElementById(rootId);
  if (!rootEl) {
    throw new Error(`Missing #${rootId} element`);
  }

  void initBackendConfig();

  createRoot(rootEl).render(
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>,
  );
}
