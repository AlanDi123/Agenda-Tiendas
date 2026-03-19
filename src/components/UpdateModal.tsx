import { useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { dismissUpdate } from '../services/updateService';
import type { UpdateCheckResult } from '../types/update';
import './UpdateModal.css';

interface UpdateModalProps {
  isOpen: boolean;
  update: UpdateCheckResult | null;
  onClose: () => void;
  onDismiss?: () => void;
}

export function UpdateModal({ isOpen, update, onClose, onDismiss }: UpdateModalProps) {
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!update) return null;

  const handleUpdateNow = async () => {
    setIsDownloading(true);
    setError(null);
    setProgress(0);
    try {
      const { downloadAndInstall } = await import('../services/updateService');
      await downloadAndInstall(update.apkUrl, (pct) => setProgress(pct));
      await dismissUpdate(update.latestVersion);
      onClose();
      onDismiss?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descargar actualización');
      setIsDownloading(false);
      setProgress(0);
    }
  };

  const handleLater = async () => {
    await dismissUpdate(update.latestVersion);
    onClose();
    onDismiss?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="modal"
      showCloseButton={!update.mandatory}
      title={update.mandatory ? '⚠️ Actualización Requerida' : '🎉 Nueva Versión Disponible'}
    >
      <div className="update-modal">
        <div className="update-modal-header">
          <div className="update-version-badge">
            <span className="update-version-label">Versión</span>
            <span className="update-version-number">{update.latestVersion}</span>
          </div>
          {update.mandatory && <span className="update-mandatory-badge">Obligatoria</span>}
        </div>

        <div className="update-modal-content">
          <h4 className="update-changelog-title">Novedades:</h4>
          <div className="update-changelog">{update.changelog}</div>
        </div>

        {isDownloading && (
          <div className="update-progress-container">
            <div className="update-progress-label">
              {progress < 80 ? 'Descargando...' : progress < 100 ? 'Instalando...' : '¡Listo! Reiniciando...'}
              <span>{progress}%</span>
            </div>
            <div className="update-progress-bar">
              <div className="update-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="update-modal-error">
            <span>⚠️</span> {error}
          </div>
        )}

        <div className="update-modal-actions">
          {!update.mandatory && !isDownloading && (
            <Button variant="secondary" onClick={handleLater} fullWidth>
              Recordarme después
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleUpdateNow}
            loading={isDownloading}
            disabled={isDownloading}
            fullWidth
          >
            {isDownloading ? `${progress}%` : 'Actualizar ahora'}
          </Button>
        </div>

        {!isDownloading && (
          <p className="update-modal-info">
            📦 Se descargará e instalará una nueva versión del APK
          </p>
        )}
      </div>
    </Modal>
  );
}
