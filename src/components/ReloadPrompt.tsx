import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './Button';
import './ReloadPrompt.css';

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Chequear actualizaciones cada hora por si el usuario deja la app abierta
      r && setInterval(() => { r.update() }, 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.error('Error en Service Worker:', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="reload-prompt-container">
      <div className="reload-prompt-toast card">
        <div className="reload-prompt-message">
          <span className="reload-prompt-icon">🚀</span>
          <div className="reload-prompt-text">
            <strong>{offlineReady ? '¡App lista offline!' : '¡Nueva actualización disponible!'}</strong>
            <p>{offlineReady ? 'Dommuss puede funcionar sin internet.' : '¿Deseas instalar la nueva versión ahora?'}</p>
          </div>
        </div>
        <div className="reload-prompt-actions">
          {needRefresh && (
            <Button variant="primary" onClick={() => updateServiceWorker(true)}>
              Actualizar
            </Button>
          )}
          <Button variant="secondary" onClick={() => close()}>
            {needRefresh ? 'Más tarde' : 'Cerrar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
