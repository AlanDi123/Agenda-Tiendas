import { useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { downloadAndInstall, dismissUpdate } from '../services/updateService';
import type { UpdateCheckResult } from '../services/updateService';
import './UpdateModal.css';

interface UpdateModalProps {
  isOpen: boolean;
  update: UpdateCheckResult | null;
  onClose: () => void;
  onDismiss?: () => void;
}

export function UpdateModal({ isOpen, update, onClose, onDismiss }: UpdateModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!update) return null;

  const handleUpdateNow = async () => {
    setIsDownloading(true);
    setError(null);

    try {
      await downloadAndInstall(update.apkUrl);
      
      // Dismiss this update so we don't prompt again immediately
      await dismissUpdate(update.latestVersion);
      
      // Close modal
      onClose();
      
      // Call onDismiss if provided
      onDismiss?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descargar actualización');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleLater = async () => {
    await dismissUpdate(update.latestVersion);
    onClose();
    onDismiss?.();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
        {/* Version Info */}
        <div className="update-modal-header">
          <div className="update-version-badge">
            <span className="update-version-label">Versión</span>
            <span className="update-version-number">{update.latestVersion}</span>
          </div>
          {update.mandatory && (
            <span className="update-mandatory-badge">Obligatoria</span>
          )}
        </div>

        {/* Changelog */}
        <div className="update-modal-content">
          <h4 className="update-changelog-title">Novedades:</h4>
          <div className="update-changelog">
            {update.changelog}
          </div>
          <p className="update-published">
            Publicada el {formatDate(update.publishedAt)}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="update-modal-error">
            <span className="update-error-icon">⚠️</span>
            {error}
          </div>
        )}

        {/* Minimum Version Warning */}
        {!update.minVersionSupported && (
          <div className="update-modal-warning">
            <span className="update-warning-icon">⚠️</span>
            <p>
              Tu versión actual es demasiado antigua. Debes actualizar para continuar usando la aplicación.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="update-modal-actions">
          {!update.mandatory && (
            <Button
              variant="secondary"
              onClick={handleLater}
              disabled={isDownloading}
              fullWidth
            >
              Recordarme después
            </Button>
          )}
          
          <Button
            variant="primary"
            onClick={handleUpdateNow}
            loading={isDownloading}
            fullWidth
          >
            {isDownloading ? 'Descargando...' : update.mandatory ? 'Actualizar Ahora' : 'Actualizar Ahora'}
          </Button>
        </div>

        {/* Download Info */}
        <p className="update-modal-info">
          📱 La actualización se descargará e instalará en tu dispositivo Android
        </p>
      </div>
    </Modal>
  );
}
