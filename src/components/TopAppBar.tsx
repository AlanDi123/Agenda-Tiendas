import type { CalendarView, Profile } from '../types';
import './TopAppBar.css';

interface TopAppBarProps {
  title: string;
  subtitle?: string;
  onViewToggle: () => void;
  currentView: CalendarView;
  onProfileClick?: () => void;
  profileName?: string;
  profileColor?: string;
  profileInitials?: string;
  onDarkModeToggle?: () => void;
  darkMode?: boolean;
  profiles?: Profile[];
  filterProfileId?: string | null;
  onFilterChange?: (profileId: string | null) => void;
}

// Dommuss Logo SVG - Diseño oficial mejorado
function DommussLogo() {
  return (
    <svg 
      width="32" 
      height="32" 
      viewBox="0 0 100 100" 
      fill="none" 
      className="dommuss-logo" 
      aria-label="Dommuss"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Fondo circular con gradiente */}
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4A90D9" />
          <stop offset="100%" stopColor="#357ABD" />
        </linearGradient>
        <filter id="logoShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.2" />
        </filter>
      </defs>
      
      {/* Círculo base */}
      <circle cx="50" cy="50" r="48" fill="url(#logoGradient)" filter="url(#logoShadow)" />
      
      {/* Casa simplificada - techo */}
      <path 
        d="M25 55L50 30L75 55" 
        stroke="white" 
        strokeWidth="6" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none"
      />
      
      {/* Casa - paredes */}
      <rect x="30" y="55" width="40" height="20" stroke="white" strokeWidth="6" fill="none" strokeLinejoin="round" />
      
      {/* Checkmark naranja - éxito/verificación */}
      <path 
        d="M42 65L50 73L62 58" 
        stroke="#F5A623" 
        strokeWidth="7" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none"
      />
    </svg>
  );
}

export function TopAppBar({
  title,
  subtitle,
  onViewToggle,
  currentView,
  onProfileClick,
  profileName,
  profileColor,
  profileInitials,
  onDarkModeToggle,
  darkMode,
  profiles,
  filterProfileId,
  onFilterChange,
}: TopAppBarProps) {
  return (
    <header className="top-app-bar">
      <div className="top-app-bar-content">
        <div className="top-app-bar-title-section">
          <div className="top-app-bar-logo">
            <DommussLogo />
            <span className="top-app-bar-brand">Dommuss</span>
          </div>
          <div className="top-app-bar-title-info">
            <h1 className="top-app-bar-title">{title}</h1>
            {subtitle && <p className="top-app-bar-subtitle">{subtitle}</p>}
          </div>
        </div>

        <div className="top-app-bar-actions">
          {/* Botón de filtro por miembro */}
          {profiles && profiles.length > 0 && (
            <div className="top-app-bar-filter">
              <select
                className="top-app-bar-filter-select"
                value={filterProfileId || ''}
                onChange={(e) => onFilterChange?.(e.target.value || null)}
                aria-label="Filtrar por miembro"
              >
                <option value="">Todos</option>
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            className="top-app-bar-icon-btn"
            onClick={onViewToggle}
            aria-label={`Cambiar a vista ${currentView === 'month' ? 'diaria' : 'mensual'}`}
            title="Cambiar vista"
          >
            {currentView === 'month' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            )}
          </button>

          {onDarkModeToggle && (
            <button
              className="top-app-bar-icon-btn"
              onClick={onDarkModeToggle}
              aria-label={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
              title={darkMode ? 'Modo claro' : 'Modo oscuro'}
            >
              {darkMode ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
          )}

          {onProfileClick && profileInitials && (
            <button
              className="top-app-bar-profile"
              onClick={onProfileClick}
              aria-label={`Perfil de ${profileName}`}
              style={{ backgroundColor: profileColor }}
            >
              {profileInitials}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
