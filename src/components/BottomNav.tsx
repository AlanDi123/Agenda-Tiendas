import type { CalendarView } from '../types';
import './BottomNav.css';

interface BottomNavProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

// Iconos Dommuss style - SVG
function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

export function BottomNav({ currentView, onViewChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navegación principal">
      {/* Casa - Deshabilitado */}
      <button
        className="bottom-nav-item disabled"
        aria-label="Inicio (deshabilitado)"
        disabled
      >
        <span className="bottom-nav-icon">
          <HomeIcon />
        </span>
        <span>Casa</span>
      </button>

      {/* Calendario - Activo */}
      <button
        className={`bottom-nav-item ${currentView === 'month' ? 'active' : ''}`}
        onClick={() => onViewChange('month')}
        aria-label="Vista mensual"
        aria-current={currentView === 'month' ? 'page' : undefined}
      >
        <span className="bottom-nav-icon">
          <CalendarIcon />
        </span>
        <span>Agenda</span>
      </button>

      {/* Lista - Habilitado */}
      <button
        className={`bottom-nav-item ${currentView === 'lists' ? 'active' : ''}`}
        onClick={() => onViewChange('lists')}
        aria-label="Lista de compras"
        aria-current={currentView === 'lists' ? 'page' : undefined}
      >
        <span className="bottom-nav-icon">
          <ListIcon />
        </span>
        <span>Lista</span>
      </button>

      {/* Carrito - Deshabilitado */}
      <button
        className="bottom-nav-item disabled"
        aria-label="Tienda (deshabilitado)"
        disabled
      >
        <span className="bottom-nav-icon">
          <CartIcon />
        </span>
        <span>Tienda</span>
      </button>

      {/* Menú - Habilitado */}
      <button
        className={`bottom-nav-item ${currentView === 'menu' ? 'active' : ''}`}
        onClick={() => onViewChange('menu')}
        aria-label="Menú semanal"
        aria-current={currentView === 'menu' ? 'page' : undefined}
      >
        <span className="bottom-nav-icon">
          <MenuIcon />
        </span>
        <span>Menú</span>
      </button>
    </nav>
  );
}
