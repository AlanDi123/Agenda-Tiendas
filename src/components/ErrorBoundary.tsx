import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AppLogger } from '../services/logger';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Nombre del componente — aparece en el fallback y en los logs */
  name?: string;
  /** Si true, muestra un fallback compacto inline (para partes de UI) en vez del full-screen */
  inline?: boolean;
  /** Callback cuando ocurre un error */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const context = this.props.name ? `[${this.props.name}]` : '';
    AppLogger.log('error', `React ErrorBoundary ${context}`, {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => window.location.reload();
  handleGoBack = () => window.history.back();

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    if (this.props.inline) {
      return (
        <div className="error-boundary-inline" role="alert">
          <span className="error-boundary-inline-icon">⚠️</span>
          <span className="error-boundary-inline-msg">
            {this.props.name ? `Error en ${this.props.name}` : 'Error al cargar este componente'}
          </span>
          <button className="error-boundary-inline-retry" onClick={this.reset}>
            Reintentar
          </button>
        </div>
      );
    }

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-content">
          <div className="error-boundary-icon">⚠️</div>
          <h2 className="error-boundary-title">Algo salió mal</h2>
          {this.props.name && (
            <p className="error-boundary-subtitle">Sección: {this.props.name}</p>
          )}
          <p className="error-boundary-message">
            Ha ocurrido un error inesperado. El resto de la app sigue funcionando.
          </p>
          {this.state.error && (
            <details className="error-boundary-details">
              <summary>Ver detalles técnicos</summary>
              <p className="error-boundary-error-message">{this.state.error.message}</p>
            </details>
          )}
          <div className="error-boundary-actions">
            <button
              className="error-boundary-btn error-boundary-btn-primary"
              onClick={this.reset}
            >
              🔄 Reintentar
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
}

/** Alias semántico para usarlo como Global Error Boundary en main.tsx */
export const GlobalErrorBoundary = ErrorBoundary;

/** HOC: envuelve un componente en un ErrorBoundary inline */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  name?: string
) {
  const displayName = name || WrappedComponent.displayName || WrappedComponent.name || 'Component';
  const BoundedComponent = (props: P) => (
    <ErrorBoundary name={displayName} inline>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
  BoundedComponent.displayName = `WithErrorBoundary(${displayName})`;
  return BoundedComponent;
}
