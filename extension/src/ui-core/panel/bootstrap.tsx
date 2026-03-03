import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';

import App from '@entrypoints/sidepanel/ui/App.js';
import ErrorBoundary from '@entrypoints/sidepanel/ui/components/ErrorBoundary.js';
import { initBackendConfig } from '@shared/config/backend.js';
import { queryClient } from '@entrypoints/sidepanel/ui/query/client.js';

export type MountPanelAppOptions = {
  rootId?: string;
  connectPortName?: string;
};

export function mountPanelApp(options: MountPanelAppOptions = {}): void {
  const { rootId = 'root', connectPortName } = options;

  if (connectPortName) {
    chrome.runtime.connect({ name: connectPortName });
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
