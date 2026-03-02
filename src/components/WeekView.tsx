import { format, isToday } from 'date-fns';
import type { ExpandedEvent } from '../types';
import './WeekView.css';

interface WeekViewProps {
  currentDate: Date;
  events: ExpandedEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: ExpandedEvent) => void;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Calcular eventos superpuestos para un día específico
function getOverlappingEventsForDay(dayEvents: ExpandedEvent[]): Array<{
  event: ExpandedEvent;
  row: number;
  column: number;
  totalRows: number;
  totalColumns: number;
}> {
  if (dayEvents.length === 0) return [];
  if (dayEvents.length === 1) {
    return [{ event: dayEvents[0], row: 0, column: 0, totalRows: 1, totalColumns: 1 }];
  }

  // Ordenar eventos por hora de inicio
  const sortedEvents = [...dayEvents].sort((a, b) => {
    const startA = a.startDate.getHours() * 60 + a.startDate.getMinutes();
    const startB = b.startDate.getHours() * 60 + b.startDate.getMinutes();
    return startA - startB;
  });

  // Agrupar eventos que se superponen en el mismo bloque de tiempo
  const overlappingGroups: ExpandedEvent[][] = [];
  const processed = new Set<string>();

  for (const event of sortedEvents) {
    if (processed.has(event.id)) continue;

    const group: ExpandedEvent[] = [event];
    processed.add(event.id);

    const eventStart = event.startDate.getHours() * 60 + event.startDate.getMinutes();
    const eventEnd = event.endDate.getHours() * 60 + event.endDate.getMinutes();

    for (const other of sortedEvents) {
      if (processed.has(other.id)) continue;

      const otherStart = other.startDate.getHours() * 60 + other.startDate.getMinutes();
      const otherEnd = other.endDate.getHours() * 60 + other.endDate.getMinutes();

      // Verificar superposición
      if (otherStart < eventEnd && otherEnd > eventStart) {
        group.push(other);
        processed.add(other.id);
      }
    }

    overlappingGroups.push(group);
  }

  // Calcular posiciones para cada grupo
  const result: Array<{
    event: ExpandedEvent;
    row: number;
    column: number;
    totalRows: number;
    totalColumns: number;
  }> = [];

  for (const group of overlappingGroups) {
    const groupSize = group.length;

    if (groupSize === 1) {
      result.push({ event: group[0], row: 0, column: 0, totalRows: 1, totalColumns: 1 });
    } else if (groupSize === 2) {
      // 2 eventos: uno arriba (100%), uno abajo (100%)
      result.push({ event: group[0], row: 0, column: 0, totalRows: 2, totalColumns: 1 });
      result.push({ event: group[1], row: 1, column: 0, totalRows: 2, totalColumns: 1 });
    } else {
      // 3+ eventos: grilla cuadrada
      // Primera fila: 1 evento (100% ancho, 50% alto)
      // Segunda fila: eventos restantes divididos horizontalmente
      result.push({ event: group[0], row: 0, column: 0, totalRows: 2, totalColumns: groupSize - 1 });

      for (let i = 1; i < group.length; i++) {
        result.push({
          event: group[i],
          row: 1,
          column: i - 1,
          totalRows: 2,
          totalColumns: groupSize - 1,
        });
      }
    }
  }

  return result;
}

export function WeekView({
  currentDate,
  events,
  onDayClick,
  onEventClick,
}: WeekViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();

  // Obtener el lunes de la semana actual
  const currentDay = new Date(year, month, day).getDay() || 7;
  const monday = new Date(year, month, day - (currentDay - 1));

  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }

  // Agrupar eventos por día
  const eventsByDay = events.reduce((acc, event) => {
    const dayKey = format(event.startDate, 'yyyy-MM-dd');
    if (!acc[dayKey]) {
      acc[dayKey] = [];
    }
    acc[dayKey].push(event);
    return acc;
  }, {} as Record<string, ExpandedEvent[]>);

  // Horas del día para la grilla (6:00 a 23:00)
  const hours = Array.from({ length: 18 }, (_, i) => i + 6);

  return (
    <div className="week-view">
      <div className="week-view-header">
        <div className="week-view-times"></div>
        {weekDays.map((day, index) => {
          const isTodayDate = isToday(day);
          return (
            <button
              key={index}
              className={`week-view-day-header ${isTodayDate ? 'week-view-day-today' : ''}`}
              onClick={() => onDayClick(day)}
              aria-label={WEEKDAYS[index]}
            >
              <span className="week-view-day-name">{WEEKDAYS[index]}</span>
              <span className={`week-view-day-number ${isTodayDate ? 'week-view-day-number-today' : ''}`}>
                {format(day, 'd')}
              </span>
            </button>
          );
        })}
      </div>

      <div className="week-view-grid">
        <div className="week-view-times">
          {hours.map(hour => (
            <div key={hour} className="week-view-time">
              {format(new Date(2024, 0, 1, hour), 'HH:00')}
            </div>
          ))}
        </div>

        {weekDays.map((day, dayIndex) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay[dayKey] || [];
          const isTodayDate = isToday(day);

          // Calcular posiciones para eventos superpuestos
          const positionedEvents = getOverlappingEventsForDay(dayEvents);

          return (
            <div
              key={dayIndex}
              className={`week-view-column ${isTodayDate ? 'week-view-column-today' : ''}`}
            >
              {hours.map(hour => (
                <div key={hour} className="week-view-cell" />
              ))}

              {positionedEvents.map(({ event, row: _row, column, totalRows, totalColumns }) => {
                const startHour = new Date(event.startDate).getHours();
                const startMinute = new Date(event.startDate).getMinutes();
                const endHour = new Date(event.endDate).getHours();
                const endMinute = new Date(event.endDate).getMinutes();

                // Solo mostrar si está dentro del rango visible (6:00 - 23:00)
                if (startHour < 6) return null;

                const top = ((startHour - 6) * 60 + startMinute) / 60;
                const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
                const durationHours = durationMinutes / 60;
                const baseHeight = Math.max(durationHours, 0.5);

                // Calcular posición y tamaño para grilla cuadrada
                const widthPercent = totalColumns > 1 ? 100 / totalColumns : 100;
                const leftPercent = column * widthPercent;
                const heightMultiplier = totalRows > 1 ? 0.5 : 1;
                const finalHeight = baseHeight * heightMultiplier;

                return (
                  <button
                    key={event.id}
                    className="week-view-event week-view-event-grid"
                    style={{
                      top: `${top}rem`,
                      height: `${finalHeight}rem`,
                      backgroundColor: event.color,
                      left: `calc(2px + ${leftPercent}%)`,
                      width: `calc(${widthPercent}% - 4px)`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    aria-label={`${event.title}, ${format(event.startDate, 'HH:mm')} - ${format(event.endDate, 'HH:mm')}`}
                    title={`${event.title}\n${format(event.startDate, 'HH:mm')} - ${format(event.endDate, 'HH:mm')}`}
                  >
                    <span className="week-view-event-title">{event.title}</span>
                    <span className="week-view-event-time">
                      {format(event.startDate, 'HH:mm')} - {format(event.endDate, 'HH:mm')}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
