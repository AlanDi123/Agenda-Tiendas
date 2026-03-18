import { format, isSameMonth, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ExpandedEvent } from '../types';
import './MonthView.css';

interface MonthViewProps {
  currentDate: Date;
  events: ExpandedEvent[];
  onDayClick: (date: Date) => void;
  filterProfileId?: string | null;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Iconos de categoría
const getCategoryIcon = (category?: string) => {
  const icons: Record<string, string> = {
    invitada: '💌',
    mama_xv: '👑',
    mama_novios: '💍',
    madrina: '🌸',
    dama_honor: '💐',
    otro: '📌',
  };
  return category ? (icons[category] || '📌') : '📌';
};

export function MonthView({
  currentDate,
  events,
  onDayClick,
  filterProfileId,
}: MonthViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);

  // Ajustar para comenzar en lunes
  const startDay = firstDayOfMonth.getDay() || 7; // 0 (domingo) -> 7
  const daysBeforeMonth = startDay - 1;

  const firstDay = new Date(year, month, 1 - daysBeforeMonth);
  const totalDays = 42; // 6 semanas para cubrir todos los casos

  const days: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    const day = new Date(firstDay);
    day.setDate(day.getDate() + i);
    days.push(day);
  }

  // Filtrar eventos por perfil si hay filtro activo
  const filteredEvents = filterProfileId
    ? events.filter(event => event.assignedProfileIds.includes(filterProfileId))
    : events;

  // Agrupar eventos por día
  const eventsByDay = filteredEvents.reduce((acc, event) => {
    const dayKey = format(event.startDate, 'yyyy-MM-dd');
    if (!acc[dayKey]) {
      acc[dayKey] = [];
    }
    acc[dayKey].push(event);
    return acc;
  }, {} as Record<string, ExpandedEvent[]>);

  return (
    <div className="month-view" onClick={(e) => e.stopPropagation()}>
      <div className="month-view-header">
        {WEEKDAYS.map(day => (
          <div key={day} className="month-weekday">
            {day}
          </div>
        ))}
      </div>

      <div className="month-view-grid">
        {days.map((day, index) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay[dayKey] || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);

          return (
            <button
              key={index}
              className={`month-day ${!isCurrentMonth ? 'month-day-other' : ''} ${isTodayDate ? 'month-day-today' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onDayClick(day);
              }}
              aria-label={`${format(day, 'd MMMM yyyy', { locale: es })}, ${dayEvents.length} eventos`}
            >
              <span className={`month-day-number ${isTodayDate ? 'month-day-number-today' : ''}`}>
                {format(day, 'd')}
              </span>

              {dayEvents.length > 0 && (
                <div className="month-day-events">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className="month-day-event-bar"
                      style={{ backgroundColor: event.color }}
                      title={`${event.title} - ${format(event.startDate, 'HH:mm')}`}
                    >
                      <span className="month-day-event-category">
                        {getCategoryIcon(event.category)}
                      </span>
                      <span className="month-day-event-title">{event.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="month-day-more">
                      +{dayEvents.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
