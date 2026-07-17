import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unexpected application error', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="workspace-gate" role="alert">
          <div className="workspace-gate-card">
            <strong>Something went wrong</strong>
            <p>The page could not be displayed. Reload to recover your latest saved data.</p>
            <button className="button primary" onClick={() => window.location.reload()}>Reload application</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
