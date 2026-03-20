import "@ui/panel/styles.css";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "@apps/sidepanel/ui/components/ErrorBoundary.js";
import { queryClient } from "@apps/sidepanel/ui/query/client.js";
import SpotlightGraphApp from "@apps/spotlight-graph/SpotlightGraphApp.js";
import { readLayoutCache } from "@shared/graph-layout-cache/cache.js";

// Pre-fetch cached layout BEFORE React mounts — ensures it's available
// synchronously in GraphCanvas.useMemo on first render
const cachePromise = readLayoutCache("active");

async function mount(): Promise<void> {
  const cached = await cachePromise;
  globalThis.__trailCachedLayout = cached;

  const root = createRoot(document.getElementById("root")!);
  root.render(
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SpotlightGraphApp />
      </QueryClientProvider>
    </ErrorBoundary>,
  );
}

void mount();
