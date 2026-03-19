import "@ui/panel/styles.css";
import "./ui/account.css";

import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "@entrypoints/sidepanel/ui/components/ErrorBoundary.js";
import { initBackendConfig } from "@shared/config/backend.js";
import { queryClient } from "./ui/query-client.js";
import AccountApp from "./ui/AccountApp.js";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element");
}

void initBackendConfig();

createRoot(rootEl).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AccountApp />
    </QueryClientProvider>
  </ErrorBoundary>,
);
