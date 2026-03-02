import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ExpandedEvent, Profile } from '../types';
import { Modal } from './Modal';
import { Button } from './Button';
import { AvatarGroup } from './Avatar';
import './EventDetail.css';

interface EventDetailProps {
  isOpen: boolean;
  event: ExpandedEvent | null;
  profiles: Profile[];
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function EventDetail({
  isOpen,
  event,
  profiles,
  onEdit,
  onDelete,
  onClose,
}: EventDetailProps) {
  if (!event) return null;

  const assignedProfiles = profiles.filter(p => event.assignedProfileIds.includes(p.id));
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);

  const avatarProfiles = assignedProfiles.map(p => ({
    name: p.name,
    initials: p.initials,
    color: p.avatarColor,
  }));

  const formatDate = (date: Date) => format(date, "EEEE, d 'de' MMMM yyyy", { locale: es });
  const formatTime = (date: Date) => format(date, 'HH:mm');

  // Capitalize
  const formattedStartDate = formatDate(startDate).charAt(0).toUpperCase() + formatDate(startDate).slice(1);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
    >
      <div className="event-detail-bottom-sheet">
        {/* Handle para arrastrar */}
        <div className="event-detail-handle" onClick={onClose} />

        {/* Avatares en la parte superior */}
        {avatarProfiles.length > 0 && (
          <div className="event-detail-avatars">
            <AvatarGroup profiles={avatarProfiles} max={5} size="lg" />
          </div>
        )}

        {/* Header con color del evento */}
        <div
          className="event-detail-header"
          style={{ backgroundColor: event.color }}
        >
          <h2 className="event-detail-title">{event.title}</h2>
          {event.isRecurring && (
            <span className="event-detail-recurring">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              Recurrente
            </span>
          )}
        </div>

        <div className="event-detail-body">
          <div className="event-detail-row">
            <span className="event-detail-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
              </svg>
            </span>
            <div className="event-detail-info">
              <span className="event-detail-label">Fecha</span>
              <span className="event-detail-value">{formattedStartDate}</span>
            </div>
          </div>

          <div className="event-detail-row">
            <span className="event-detail-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <div className="event-detail-info">
              <span className="event-detail-label">Hora</span>
              <span className="event-detail-value">
                {event.allDay ? 'Todo el día' : `${formatTime(startDate)} - ${formatTime(endDate)}`}
              </span>
            </div>
          </div>

          {event.location && (
            <div className="event-detail-row">
              <span className="event-detail-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <div className="event-detail-info">
                <span className="event-detail-label">Ubicación</span>
                <span className="event-detail-value">{event.location}</span>
              </div>
            </div>
          )}

          {event.category && (
            <div className="event-detail-row">
              <span className="event-detail-icon">🏷️</span>
              <div className="event-detail-info">
                <span className="event-detail-label">Categoría</span>
                <span className="event-detail-value">{event.category.charAt(0).toUpperCase() + event.category.slice(1)}</span>
              </div>
            </div>
          )}

          {event.notes && (
            <div className="event-detail-notes">
              <span className="event-detail-label">Notas</span>
              <p className="event-detail-notes-text">{event.notes}</p>
            </div>
          )}
        </div>

        <div className="event-detail-actions">
          <Button variant="secondary" onClick={onDelete} type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Eliminar
          </Button>
          <Button variant="primary" onClick={onEdit} type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Editar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
