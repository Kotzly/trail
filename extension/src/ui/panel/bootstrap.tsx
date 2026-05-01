import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import App from "@apps/sidepanel/ui/App.js";
import ErrorBoundary from "@ui/components/error-boundary.js";
import { queryClient } from "@ui/query/client.js";
import { ThemeProvider } from "@ui/providers/theme-provider.js";
import { browser } from "@shared/platform/webext.js";
import { MotionPlatformProvider } from "@features/graph/motion/index.js";

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

  createRoot(rootEl).render(
    <ErrorBoundary source="sidepanel">
      <QueryClientProvider client={queryClient}>
        <MotionPlatformProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </MotionPlatformProvider>
      </QueryClientProvider>
    </ErrorBoundary>,
  );
}
