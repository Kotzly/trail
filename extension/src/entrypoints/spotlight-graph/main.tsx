import '@ui/panel/styles.css';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from '@entrypoints/sidepanel/ui/components/ErrorBoundary.js';
import { initBackendConfig } from '@shared/config/backend.js';
import { queryClient } from '@entrypoints/sidepanel/ui/query/client.js';
import SpotlightGraphApp from './SpotlightGraphApp.js';

void initBackendConfig();

const root = createRoot(document.getElementById('root')!);
root.render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <SpotlightGraphApp />
    </QueryClientProvider>
  </ErrorBoundary>,
);
