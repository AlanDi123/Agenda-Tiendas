import './RouteLoadingFallback.css';

type Props = {
  label?: string;
};

/**
 * Fallback para React.Suspense al cargar vistas/modales en lazy.
 * Estética alineada con marca Dommuss (primario #2D3E50).
 */
export function RouteLoadingFallback({ label = 'Cargando…' }: Props) {
  return (
    <div className="route-loading-fallback" role="status" aria-live="polite">
      <div className="route-loading-fallback__spinner" aria-hidden />
      <span className="route-loading-fallback__label">{label}</span>
    </div>
  );
}
