import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AppLogger } from '../services/logger';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    AppLogger.log('error', 'React Error Boundary Caught', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoBack = () => {
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">⚠️</div>
            <h2 className="error-boundary-title">Algo salió mal</h2>
            <p className="error-boundary-message">
              Ha ocurrido un error inesperado. No te preocupes, hemos registrado el problema.
            </p>
            {this.state.error && (
              <details className="error-boundary-details">
                <summary>Ver detalles técnicos</summary>
                <p className="error-boundary-error-message">
                  {this.state.error.message}
                </p>
              </details>
            )}
            <div className="error-boundary-actions">
              <button
                className="error-boundary-btn error-boundary-btn-primary"
                onClick={this.handleReload}
              >
                🔄 Recargar App
              </button>
              <button
                className="error-boundary-btn error-boundary-btn-secondary"
                onClick={this.handleGoBack}
              >
                ← Volver
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
