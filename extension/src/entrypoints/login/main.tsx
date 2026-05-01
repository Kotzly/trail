import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "@ui/panel/styles.css";
import "@shared/styles/fonts.js";
import LoginApp from "@apps/login/LoginApp.js";
import ErrorBoundary from "@ui/components/error-boundary.js";
import { queryClient } from "@ui/query/client.js";
import { ThemeProvider } from "@ui/providers/theme-provider.js";
import { initObservability } from "@shared/lib/observability.js";

void initObservability("login");

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <ErrorBoundary source="login">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LoginApp />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>,
  );
}
