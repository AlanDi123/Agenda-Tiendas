import type { CalendarView } from '../types';
import './BottomNav.css';

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

function ContactsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
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

interface BottomNavProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

export function BottomNav({ currentView, onViewChange }: BottomNavProps) {
  const items = [
    { view: 'month' as CalendarView, icon: <CalendarIcon />, label: 'Agenda' },
    { view: 'lists' as CalendarView, icon: <ListIcon />, label: 'Lista' },
    { view: 'contacts' as CalendarView, icon: <ContactsIcon />, label: 'Contactos' },
    { view: 'notes' as CalendarView, icon: <NotesIcon />, label: 'Notas' },
    { view: 'menu' as CalendarView, icon: <MenuIcon />, label: 'Menú' },
  ];

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navegación principal">
      {items.map(({ view, icon, label }) => (
        <button
          key={view}
          className={`bottom-nav-item ${currentView === view ? 'active' : ''}`}
          onClick={() => onViewChange(view)}
          aria-label={label}
          aria-current={currentView === view ? 'page' : undefined}
        >
          <span className="bottom-nav-icon">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
