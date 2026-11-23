import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page center">
        <h1>Қате шықты · Something went wrong</h1>
        <p className="muted small">{this.state.error.message}</p>
        <button className="btn primary" onClick={() => location.reload()}>
          ↻ Қайта жүктеу · Reload
        </button>
      </div>
    );
  }
}
