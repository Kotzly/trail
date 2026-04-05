import React, { Component, type ErrorInfo, type ReactNode } from "react";
import TrailLogo from "@ui/components/trail-logo";
import { Button } from "@ui/components/ui/button";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  copied: boolean;
};

export default class ErrorBoundary extends Component<Props, State> {
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Trail ErrorBoundary caught:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  componentWillUnmount(): void {
    if (this.copiedTimer) {
      clearTimeout(this.copiedTimer);
    }
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleCopyDiagnostics = (): void => {
    const { error, componentStack } = this.state;

    let version = "unknown";
    try {
      version = chrome.runtime.getManifest().version;
    } catch {
      // Extension API unavailable
    }

    const diagnostic = [
      "Trail crash report",
      "==================",
      `Error: ${error?.message ?? "Unknown error"}`,
      `Version: ${version}`,
      `User Agent: ${navigator.userAgent}`,
      `Timestamp: ${new Date().toISOString()}`,
      "",
      "Component Stack:",
      componentStack ?? "(unavailable)",
      "",
      "Stack Trace:",
      error?.stack ?? "(unavailable)",
    ].join("\n");

    navigator.clipboard.writeText(diagnostic).then(() => {
      this.setState({ copied: true });
      if (this.copiedTimer) {
        clearTimeout(this.copiedTimer);
      }
      this.copiedTimer = setTimeout(() => {
        this.setState({ copied: false });
        this.copiedTimer = null;
      }, 2000);
    });
  };

  private handleSafeModeReload = (): void => {
    try {
      chrome.storage.session.clear();
    } catch {
      // Extension API unavailable
    }

    try {
      localStorage.clear();
    } catch {
      // Storage unavailable
    }

    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background text-foreground font-sans">
        <div className="flex flex-col items-center gap-4 max-w-80 px-6 py-8 text-center">
          <TrailLogo className="size-18 mb-2 opacity-50" label="Trail" />

          <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Trail ran into an unexpected error.
            <br />
            Reloading usually fixes it.
          </p>

          <div className="flex flex-col gap-2 w-full mt-2">
            <Button variant="outline" className="w-full" type="button" onClick={this.handleReload}>
              Reload Trail
            </Button>
            <Button variant="outline" className="w-full" type="button" onClick={this.handleCopyDiagnostics}>
              {this.state.copied ? "Copied!" : "Copy diagnostics"}
            </Button>
            <Button variant="outline" className="w-full" type="button" onClick={this.handleSafeModeReload}>
              Reload with safe mode
            </Button>
            <Button
              variant="outline"
              className="w-full"
              type="button"
              onClick={() => window.open("https://gettrail.net/support", "_blank")}
            >
              Contact Support
            </Button>
          </div>

          {this.state.error?.stack && (
            <details className="mt-4 text-left w-full">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Technical details
              </summary>
              <pre className="text-[11px] max-h-[200px] overflow-auto whitespace-pre-wrap break-all mt-2 p-2 bg-muted rounded-md">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
