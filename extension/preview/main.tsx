// Install chrome/browser polyfill before any sidepanel import touches globals.
import "./mocks/chrome-shim";

import "@ui/panel/styles.css";
import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@ui/query/client";
import { ThemeProvider } from "@ui/providers/theme-provider";
import { useStore } from "@apps/sidepanel/ui/state/store";
import { MotionPlatformProvider } from "@features/graph/motion/index.js";
import { fakeFlags, fakeSettings, fakeTreeUpdatedInput } from "./fake-tree";
import { PreviewApp } from "./PreviewApp";

class PreviewErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[preview] render error:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontFamily: "monospace", color: "#f87171", whiteSpace: "pre-wrap" }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Preview error</div>
          <div>{this.state.error.message}</div>
          <button
            style={{ marginTop: 12, padding: "4px 10px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: 6 }}
            onClick={() => this.setState({ error: null })}
          >
            Reset
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Seed store synchronously so the real sidepanel App starts post-bootstrap.
const store = useStore.getState();
store.bootstrapGraph(fakeSettings(), fakeTreeUpdatedInput());
store.setFlags(fakeFlags());

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("preview: missing #root");

createRoot(rootEl).render(
  <PreviewErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <MotionPlatformProvider>
        <ThemeProvider>
          <PreviewApp />
        </ThemeProvider>
      </MotionPlatformProvider>
    </QueryClientProvider>
  </PreviewErrorBoundary>,
);
