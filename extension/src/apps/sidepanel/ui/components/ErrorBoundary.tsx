import React, { Component, type ErrorInfo, type ReactNode } from "react";
import TrailLogo from "./TrailLogo.js";

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
    // Clear layout cache and any other session storage
    try {
      chrome.storage.session.clear();
    } catch {
      // Extension API unavailable
    }

    // Clear the sidepanel's own isolated localStorage
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
      <div className="error-boundary">
        <div className="error-boundary__content">
          <TrailLogo className="error-boundary__logo" label="Trail" />

          <h1 className="error-boundary__title">Something went wrong</h1>
          <p className="error-boundary__subtitle">
            Trail ran into an unexpected error.
            <br />
            Reloading usually fixes it.
          </p>

          <button className="error-boundary__btn" type="button" onClick={this.handleReload}>
            Reload Trail
          </button>

          <button
            className="error-boundary__btn"
            type="button"
            onClick={this.handleCopyDiagnostics}
          >
            {this.state.copied ? "Copied!" : "Copy diagnostics"}
          </button>

          <button
            className="error-boundary__btn"
            type="button"
            onClick={this.handleSafeModeReload}
          >
            Reload with safe mode
          </button>

          <button
            className="error-boundary__btn"
            type="button"
            onClick={() => window.open("https://gettrail.net/support", "_blank")}
          >
            Contact Support
          </button>

          {this.state.error?.stack && (
            <details
              className="error-boundary__details"
              style={{ marginTop: 16, textAlign: "left", maxWidth: "100%" }}
            >
              <summary
                className="error-boundary__summary"
                style={{
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--text-secondary, #888)",
                }}
              >
                Technical details
              </summary>
              <pre
                className="error-boundary__stack"
                style={{
                  fontSize: 11,
                  maxHeight: 200,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  marginTop: 8,
                  padding: 8,
                  background: "var(--bg-secondary, #1a1a1a)",
                  borderRadius: 4,
                }}
              >
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
