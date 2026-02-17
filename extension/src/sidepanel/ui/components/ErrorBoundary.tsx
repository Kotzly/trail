import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import TrailLogo from './TrailLogo.js';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Trail ErrorBoundary caught:', error, info.componentStack);
  }

  private handleReload = (): void => {
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

          <button
            className="error-boundary__btn"
            type="button"
            onClick={this.handleReload}
          >
            Reload Trail
          </button>

          {this.state.error ? (
            <p className="error-boundary__detail">
              {this.state.error.message}
            </p>
          ) : null}
        </div>
      </div>
    );
  }
}
