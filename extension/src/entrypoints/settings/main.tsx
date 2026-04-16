import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "@ui/panel/styles.css";
import SettingsApp from "@apps/settings/SettingsApp.js";
import { queryClient } from "@ui/query/client.js";
import { ThemeProvider } from "@ui/providers/theme-provider.js";
import { captureEvent, initObservability } from "@shared/lib/observability.js";

void initObservability("settings").then(() => {
  captureEvent("settings_opened");
});

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsApp />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}
