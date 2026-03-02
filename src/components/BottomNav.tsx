import type { CalendarView } from '../types';
import './BottomNav.css';

interface BottomNavProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onProfilesClick?: () => void;
}

export function BottomNav({ currentView, onViewChange, onProfilesClick }: BottomNavProps) {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navegación principal">
      <button
        className={`bottom-nav-item ${currentView === 'month' ? 'active' : ''}`}
        onClick={() => onViewChange('month')}
        aria-label="Vista mensual"
        aria-current={currentView === 'month' ? 'page' : undefined}
      >
        <span className="bottom-nav-emoji">📆</span>
        <span>Mes</span>
      </button>
      
      <button
        className={`bottom-nav-item ${currentView === 'week' ? 'active' : ''}`}
        onClick={() => onViewChange('week')}
        aria-label="Vista semanal"
        aria-current={currentView === 'week' ? 'page' : undefined}
      >
        <span className="bottom-nav-emoji">📅</span>
        <span>Semana</span>
      </button>
      
      <button
        className={`bottom-nav-item ${currentView === 'day' ? 'active' : ''}`}
        onClick={() => onViewChange('day')}
        aria-label="Vista diaria"
        aria-current={currentView === 'day' ? 'page' : undefined}
      >
        <span className="bottom-nav-emoji">📋</span>
        <span>Día</span>
      </button>
      
      <button
        className="bottom-nav-item"
        onClick={onProfilesClick}
        aria-label="Perfiles"
      >
        <span className="bottom-nav-emoji">👤</span>
        <span>Perfiles</span>
      </button>
    </nav>
  );
}
