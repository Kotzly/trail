import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from '../../sidepanel/ui/App.js';
import ErrorBoundary from '../../sidepanel/ui/components/ErrorBoundary.js';
import '../../sidepanel/ui/sidepanel.css';
import React from 'react';
import { initBackendConfig } from '../../shared/config/backend.js';
import { queryClient } from '../../sidepanel/ui/query/client.js';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

void initBackendConfig();

createRoot(rootEl).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </ErrorBoundary>,
);
