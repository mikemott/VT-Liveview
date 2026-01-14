import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // In production, you could log to Sentry here
    // if (import.meta.env.PROD && window.Sentry) {
    //   window.Sentry.captureException(error, { contexts: { react: errorInfo } });
    // }

    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isDark = document.documentElement.classList.contains('dark') ||
                     window.matchMedia('(prefers-color-scheme: dark)').matches;

      return (
        <div className={`error-boundary ${isDark ? 'dark' : ''}`}>
          <div className="error-boundary-content">
            <AlertTriangle size={48} className="error-icon" />
            <h2>Something went wrong</h2>
            <p>We're sorry, but something unexpected happened. Please try refreshing the page.</p>
            
            {import.meta.env.DEV && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <pre>{this.state.error.toString()}</pre>
                {this.state.errorInfo && (
                  <pre>{this.state.errorInfo.componentStack}</pre>
                )}
              </details>
            )}

            <button onClick={this.handleReset} className="error-reset-button">
              <RefreshCw size={18} />
              Refresh Page
            </button>
          </div>

          <style>{`
            .error-boundary {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #f5f5f5;
              z-index: 10000;
            }

            .error-boundary.dark {
              background: #1a1a1a;
            }

            .error-boundary-content {
              max-width: 500px;
              padding: 2rem;
              text-align: center;
              background: white;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }

            .error-boundary.dark .error-boundary-content {
              background: #2a2a2a;
              color: #f5f5f5;
            }

            .error-icon {
              color: #ef4444;
              margin-bottom: 1rem;
            }

            .error-boundary-content h2 {
              margin: 0 0 0.5rem 0;
              font-size: 1.5rem;
              font-weight: 600;
            }

            .error-boundary-content p {
              margin: 0 0 1.5rem 0;
              color: #6b7280;
            }

            .error-boundary.dark .error-boundary-content p {
              color: #9ca3af;
            }

            .error-details {
              margin: 1rem 0;
              text-align: left;
              background: #f9fafb;
              border-radius: 6px;
              padding: 1rem;
            }

            .error-boundary.dark .error-details {
              background: #1a1a1a;
            }

            .error-details summary {
              cursor: pointer;
              font-weight: 600;
              margin-bottom: 0.5rem;
            }

            .error-details pre {
              font-size: 0.75rem;
              overflow-x: auto;
              white-space: pre-wrap;
              word-wrap: break-word;
              color: #dc2626;
            }

            .error-reset-button {
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
              padding: 0.75rem 1.5rem;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              font-weight: 500;
              cursor: pointer;
              transition: background 0.2s;
            }

            .error-reset-button:hover {
              background: #2563eb;
            }

            .error-reset-button:active {
              background: #1d4ed8;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

