import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ExpandedEvent, Profile } from '../types';
import { AvatarGroup } from './Avatar';
import './DayView.css';

interface DayViewProps {
  currentDate: Date;
  events: ExpandedEvent[];
  profiles: Profile[];
  onEventClick: (event: ExpandedEvent) => void;
}

export function DayView({
  currentDate,
  events,
  profiles,
  onEventClick,
}: DayViewProps) {
  const isTodayDate = isToday(currentDate);
  const formattedDate = format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: es });
  
  // Agrupar eventos por todo el día y por hora
  const allDayEvents = events.filter(e => e.allDay);
  const timedEvents = events.filter(e => !e.allDay).sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  
  // Capitalize first letter
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  
  return (
    <div className="day-view">
      <div className={`day-view-header ${isTodayDate ? 'day-view-header-today' : ''}`}>
        <h2 className="day-view-date">{capitalizedDate}</h2>
        <p className="day-view-event-count">
          {events.length} {events.length === 1 ? 'evento' : 'eventos'}
        </p>
      </div>
      
      <div className="day-view-content">
        {events.length === 0 ? (
          <div className="day-view-empty">
            <div className="day-view-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="12" y1="14" x2="12" y2="14" />
                <line x1="12" y1="17" x2="12" y2="17" />
              </svg>
            </div>
            <h3 className="day-view-empty-title">No hay eventos hoy</h3>
            <p className="day-view-empty-text">
              ¡Disfruta de tu día libre! Usa el botón + para agregar un evento.
            </p>
          </div>
        ) : (
          <>
            {allDayEvents.length > 0 && (
              <div className="day-view-section">
                <h3 className="day-view-section-title">Todo el día</h3>
                <div className="day-view-events">
                  {allDayEvents.map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      profiles={profiles}
                      onClick={() => onEventClick(event)}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {timedEvents.length > 0 && (
              <div className="day-view-section">
                <h3 className="day-view-section-title">Programados</h3>
                <div className="day-view-events">
                  {timedEvents.map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      profiles={profiles}
                      onClick={() => onEventClick(event)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface EventCardProps {
  event: ExpandedEvent;
  profiles: Profile[];
  onClick: () => void;
}

function EventCard({ event, profiles, onClick }: EventCardProps) {
  const assignedProfiles = profiles.filter(p => event.assignedProfileIds.includes(p.id));
  const startTime = format(event.startDate, 'HH:mm');
  const endTime = format(event.endDate, 'HH:mm');
  
  const avatarProfiles = assignedProfiles.map(p => ({
    name: p.name,
    initials: p.initials,
    color: p.avatarColor,
  }));
  
  return (
    <button className="day-view-event-card" onClick={onClick}>
      <div
        className="day-view-event-color"
        style={{ backgroundColor: event.color }}
      />
      
      <div className="day-view-event-content">
        <div className="day-view-event-header">
          <h4 className="day-view-event-title">{event.title}</h4>
          {event.isRecurring && (
            <span className="day-view-event-recurring" title="Evento recurrente">
              🔄
            </span>
          )}
        </div>

        <div className="day-view-event-time">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="day-view-event-icon">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{startTime} - {endTime}</span>
        </div>

        {event.location && (
          <div className="day-view-event-location">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="day-view-event-icon">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{event.location}</span>
          </div>
        )}

        {event.notes && (
          <div className="day-view-event-notes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="day-view-event-icon">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span className="day-view-event-notes-text">{event.notes}</span>
          </div>
        )}

        {avatarProfiles.length > 0 && (
          <div className="day-view-event-profiles">
            <AvatarGroup profiles={avatarProfiles} max={3} size="sm" />
          </div>
        )}
      </div>
      
      <div className="day-view-event-arrow">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </button>
  );
}
