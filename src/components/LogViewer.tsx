import { useState } from 'react';
import { AppLogger, type LogEntry } from '../services/logger';
import { Modal } from './Modal';
import { Button } from './Button';
import './LogViewer.css';

interface LogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const levelIcons = {
  error: '❌',
  warn: '⚠️',
  info: 'ℹ️'
};

const levelColors = {
  error: '#E53935',
  warn: '#FB8C00',
  info: '#1E88E5'
};

export function LogViewer({ isOpen, onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>(AppLogger.getLogs());

  const handleClearLogs = () => {
    AppLogger.clearLogs();
    setLogs([]);
  };

  const handleExportLogs = () => {
    const logsText = AppLogger.exportLogs();
    const blob = new Blob([logsText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dommuss-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="bottom-sheet"
      showHandle={true}
      showCloseButton={false}
    >
      <div className="log-viewer">
        <div className="log-viewer-header">
          <h2 className="log-viewer-title">🛠️ Registro de Errores</h2>
          <div className="log-viewer-actions">
            {logs.length > 0 && (
              <>
                <Button
                  variant="secondary"
                  onClick={handleExportLogs}
                  type="button"
                >
                  📤 Exportar
                </Button>
                <Button
                  variant="primary"
                  onClick={handleClearLogs}
                  type="button"
                >
                  🗑️ Limpiar
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="log-viewer-content">
          {logs.length === 0 ? (
            <div className="log-viewer-empty">
              <div className="log-viewer-empty-icon">✨</div>
              <p className="log-viewer-empty-text">
                No hay errores registrados. ¡Todo funciona correctamente!
              </p>
            </div>
          ) : (
            <div className="log-viewer-list">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`log-viewer-item log-viewer-item-${log.level}`}
                >
                  <div className="log-viewer-item-header">
                    <span className="log-viewer-item-icon">
                      {levelIcons[log.level]}
                    </span>
                    <span className="log-viewer-item-level" style={{ color: levelColors[log.level] }}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="log-viewer-item-time">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  <div className="log-viewer-item-message">
                    {log.message}
                  </div>
                  {log.stack && (
                    <details className="log-viewer-item-stack">
                      <summary>Ver stack trace</summary>
                      <pre>{log.stack}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
