
import { Component, type ErrorInfo, type ReactNode } from "react";
import "./ErrorBoundary.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {

    console.error("Unhandled error in component tree:", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, message: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary__card">
            <h2>Something interrupted the session</h2>
            <p>{this.state.message ?? "An unexpected error occurred."}</p>
            <button type="button" onClick={this.handleReset} className="error-boundary__retry">
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
