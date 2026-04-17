import { Component, type ErrorInfo, type ReactNode } from "react";
import TrailLogo from "@ui/components/trail-logo.js";
import { Button } from "@ui/components/ui/button.js";
import { FeedbackDialog } from "@ui/components/feedback-dialog.js";
import { captureError, lastErrorEventId } from "@shared/lib/observability.js";

type Props = {
  children: ReactNode;
  /** Source tag attached to the bug report (e.g. "sidepanel", "settings"). */
  source?: string;
};

type State = {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  eventId: string | null;
  reportOpen: boolean;
  copied: boolean;
};

export default class ErrorBoundary extends Component<Props, State> {
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: null,
      eventId: null,
      reportOpen: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Trail ErrorBoundary caught:", error, info.componentStack);
    captureError(error, {
      componentStack: info.componentStack ?? "(unavailable)",
      kind: "react_boundary",
      source: this.props.source ?? "unknown",
    });
    this.setState({
      componentStack: info.componentStack ?? null,
      eventId: lastErrorEventId() ?? null,
    });
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
    const { error, componentStack, eventId } = this.state;

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
      `Event ID: ${eventId ?? "(not captured)"}`,
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

    const { error, eventId, reportOpen } = this.state;
    const source = this.props.source ?? "error_boundary";

    return (
      <div className="bg-background text-foreground fixed inset-0 z-[9999] flex items-center justify-center font-sans">
        <div className="flex max-w-80 flex-col items-center gap-4 px-6 py-8 text-center">
          <TrailLogo className="mb-2 size-18 opacity-50" label="Trail" />

          <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Trail ran into an unexpected error.
            <br />
            Reloading usually fixes it.
          </p>

          <div className="mt-2 flex w-full flex-col gap-2">
            <Button variant="default" className="w-full" type="button" onClick={this.handleReload}>
              Reload Trail
            </Button>
            <Button
              variant="outline"
              className="w-full"
              type="button"
              onClick={() => this.setState({ reportOpen: true })}
            >
              Send bug report
            </Button>
            <Button
              variant="outline"
              className="w-full"
              type="button"
              onClick={this.handleCopyDiagnostics}
            >
              {this.state.copied ? "Copied!" : "Copy diagnostics"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              type="button"
              onClick={this.handleSafeModeReload}
            >
              Reload with safe mode
            </Button>
          </div>

          {error?.stack && (
            <details className="mt-4 w-full text-left">
              <summary className="text-muted-foreground cursor-pointer text-xs">
                Technical details
              </summary>
              <pre className="bg-muted mt-2 max-h-[200px] overflow-auto rounded-md p-2 text-[11px] break-all whitespace-pre-wrap">
                {error.stack}
              </pre>
            </details>
          )}
        </div>

        <FeedbackDialog
          kind={reportOpen ? "bug" : null}
          onOpenChange={(open) => this.setState({ reportOpen: open })}
          associatedEventId={eventId ?? undefined}
          source={source}
        />
      </div>
    );
  }
}
