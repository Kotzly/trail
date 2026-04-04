import "@ui/panel/styles.css";
import "@apps/hub/ui/hub.css";

import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "@apps/sidepanel/ui/components/ErrorBoundary.js";
import { initBackendConfig } from "@shared/config/backend.js";
import { queryClient } from "@apps/hub/ui/query-client.js";
import HubApp from "@apps/hub/ui/HubApp.js";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element");
}

void initBackendConfig();

createRoot(rootEl).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <HubApp />
    </QueryClientProvider>
  </ErrorBoundary>,
);
