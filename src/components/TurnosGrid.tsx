import { useState, useEffect, useCallback, useRef } from 'react';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ExpandedEvent, Profile } from '../types';
import './TurnosGrid.css';

interface TurnosGridProps {
  currentDate: Date;
  events: ExpandedEvent[];
  profiles: Profile[];
  onSlotClick?: (time: string) => void;
  onEventClick?: (event: ExpandedEvent) => void;
}

const TIME_SLOT_MINUTES = 5;
const SLOTS_PER_HOUR = 60 / TIME_SLOT_MINUTES; // 12 slots por hora
const TOTAL_SLOTS = 24 * SLOTS_PER_HOUR; // 288 slots por día

export function TurnosGrid({
  currentDate,
  events,
  profiles,
  onSlotClick,
  onEventClick,
}: TurnosGridProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const gridRef = useRef<HTMLDivElement>(null);

  // Actualizar hora actual cada minuto
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Cada minuto

    return () => clearInterval(timer);
  }, []);

  // Scroll a la hora actual al montar y cuando cambia la fecha
  useEffect(() => {
    if (isToday(currentDate) && gridRef.current) {
      const currentHour = currentTime.getHours();
      const currentSlot = currentHour * SLOTS_PER_HOUR;
      const slotElement = document.querySelector(`[data-slot-index="${currentSlot}"]`);
      if (slotElement) {
        slotElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentDate, currentTime]);

  // Obtener el evento activo en un slot de tiempo específico
  const getEventAtSlot = useCallback((slotIndex: number): ExpandedEvent | null => {
    const slotTime = getSlotTime(slotIndex);
    
    for (const event of events) {
      const eventStart = format(event.startDate, 'HH:mm');
      const eventEnd = format(event.endDate, 'HH:mm');
      
      if (slotTime >= eventStart && slotTime < eventEnd) {
        return event;
      }
    }
    
    return null;
  }, [events]);

  // Verificar si este slot es el inicio de un evento
  const isEventStart = useCallback((slotIndex: number, event: ExpandedEvent): boolean => {
    const slotTime = getSlotTime(slotIndex);
    const eventStart = format(event.startDate, 'HH:mm');
    return slotTime === eventStart;
  }, []);

  // Calcular cuántos slots ocupa un evento desde este slot
  const getEventSpan = useCallback((slotIndex: number, event: ExpandedEvent): number => {
    const slotTime = getSlotTime(slotIndex);
    const eventStart = format(event.startDate, 'HH:mm');
    const eventEnd = format(event.endDate, 'HH:mm');

    if (slotTime !== eventStart) return 0;

    const startMinutes = timeToMinutes(eventStart);
    const endMinutes = timeToMinutes(eventEnd);
    const durationMinutes = endMinutes - startMinutes;

    return Math.ceil(durationMinutes / TIME_SLOT_MINUTES);
  }, []);

  // Obtener hora final del evento
  const getEventEndTime = useCallback((event: ExpandedEvent): string => {
    return format(event.endDate, 'HH:mm');
  }, []);

  // Obtener perfil asignado al evento
  const getEventProfile = useCallback((event: ExpandedEvent): Profile | null => {
    if (!event.assignedProfileIds || event.assignedProfileIds.length === 0) {
      return null;
    }
    return profiles.find(p => p.id === event.assignedProfileIds[0]) || null;
  }, [profiles]);

  // Detectar eventos que se superponen en un slot específico
  const getOverlappingEventsAtSlot = useCallback((slotIndex: number): ExpandedEvent[] => {
    const slotTime = getSlotTime(slotIndex);
    const overlapping: ExpandedEvent[] = [];

    for (const event of events) {
      const eventStart = format(event.startDate, 'HH:mm');
      const eventEnd = format(event.endDate, 'HH:mm');

      if (slotTime >= eventStart && slotTime < eventEnd) {
        overlapping.push(event);
      }
    }

    return overlapping;
  }, [events]);

  // Calcular columnas para eventos superpuestos (Google Calendar style)
  const calculateEventColumns = (overlappingEvents: ExpandedEvent[]): Map<string, { column: number; totalColumns: number }> => {
    const result = new Map<string, { column: number; totalColumns: number }>();
    const columns: ExpandedEvent[][] = [];

    // Ordenar eventos por hora de inicio
    const sortedEvents = [...overlappingEvents].sort((a, b) => {
      const startA = timeToMinutes(format(a.startDate, 'HH:mm'));
      const startB = timeToMinutes(format(b.startDate, 'HH:mm'));
      return startA - startB;
    });

    // Algoritmo greedy para asignar columnas
    for (const event of sortedEvents) {
      const eventStart = timeToMinutes(format(event.startDate, 'HH:mm'));

      let placed = false;
      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const column = columns[colIndex];
        const lastEvent = column[column.length - 1];
        const lastEnd = timeToMinutes(format(lastEvent.endDate, 'HH:mm'));

        // Si no hay superposición con el último evento de esta columna
        if (eventStart >= lastEnd) {
          column.push(event);
          result.set(event.id, { column: colIndex, totalColumns: columns.length });
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push([event]);
        result.set(event.id, { column: columns.length - 1, totalColumns: columns.length });
      }
    }

    // Actualizar totalColumns después de colocar todos los eventos
    sortedEvents.forEach(event => {
      const data = result.get(event.id);
      if (data) {
        result.set(event.id, { column: data.column, totalColumns: columns.length });
      }
    });

    return result;
  };

  // Agrupar slots para renderizado eficiente
  const renderGroupedSlots = () => {
    const rendered: React.ReactElement[] = [];
    const processedSlots = new Set<number>();
    const renderedEventIds = new Set<string>();

    for (let i = 0; i < TOTAL_SLOTS; i++) {
      if (processedSlots.has(i)) continue;

      const overlappingEvents = getOverlappingEventsAtSlot(i);

      if (overlappingEvents.length > 0) {
        // Calcular columnas para eventos superpuestos
        const columnMap = calculateEventColumns(overlappingEvents);
        const totalColumns = columnMap.size > 0 ? Array.from(columnMap.values())[0].totalColumns : 1;
        const slotWidth = 100 / totalColumns;

        overlappingEvents.forEach((event) => {
          if (isEventStart(i, event) && !renderedEventIds.has(event.id)) {
            const span = getEventSpan(i, event);
            const profile = getEventProfile(event);
            const eventColor = event.color || profile?.avatarColor || '#1E88E5';
            const slotTime = getSlotTime(i);
            const columnData = columnMap.get(event.id);
            const column = columnData?.column || 0;

            // Marcar slots como procesados
            for (let j = 0; j < span; j++) {
              processedSlots.add(i + j);
            }

            renderedEventIds.add(event.id);

            rendered.push(
              <div
                key={event.id}
                className="turno-slot turno-slot-reservado turno-slot-overlapping"
                style={{
                  '--event-color': eventColor,
                  '--span-rows': span,
                  '--overlap-column': column,
                  '--overlap-count': totalColumns,
                  '--overlap-width': slotWidth,
                } as React.CSSProperties}
                data-slot-index={i}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick?.(event);
                }}
              >
                <div className="turno-slot-time">{slotTime} - {getEventEndTime(event)}</div>
                <div className="turno-slot-content">
                  <span className="turno-slot-title">{event.title}</span>
                  {profile && (
                    <span
                      className="turno-slot-profile"
                      style={{ backgroundColor: profile.avatarColor }}
                    >
                      {profile.initials}
                    </span>
                  )}
                </div>
              </div>
            );
          }
        });
      } else if (!getEventAtSlot(i)) {
        const slotTime = getSlotTime(i);
        const isCurrentTimeSlot = isToday(currentDate) &&
          format(currentTime, 'HH:mm') === slotTime;

        rendered.push(
          <div
            key={i}
            className={`turno-slot turno-slot-disponible ${isCurrentTimeSlot ? 'turno-slot-current' : ''}`}
            data-slot-index={i}
            onClick={() => onSlotClick?.(slotTime)}
          >
            <div className="turno-slot-time">{slotTime}</div>
            <div className="turno-slot-content">
              <span className="turno-slot-available">Disponible</span>
            </div>
          </div>
        );
      }
    }

    return rendered;
  };

  // Obtener hora actual formateada
  const currentTimeLabel = format(currentTime, 'HH:mm');

  return (
    <div className="turnos-grid-container">
      <div className="turnos-grid-header">
        <h3 className="turnos-grid-title">
          📋 Turnos del {format(currentDate, "EEEE, d 'de' MMMM", { locale: es })}
        </h3>
      </div>
      
      <div className="turnos-grid">
        {renderGroupedSlots()}
        
        {/* Línea de hora actual */}
        {isToday(currentDate) && (
          <div 
            className="turnos-current-time-line"
            style={{
              top: `calc(${timeToMinutes(currentTimeLabel)} / 5 * 1.5rem)`,
            }}
          >
            <span className="current-time-label">{currentTimeLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Utilidades
function getSlotTime(slotIndex: number): string {
  const hour = Math.floor(slotIndex / SLOTS_PER_HOUR);
  const minute = (slotIndex % SLOTS_PER_HOUR) * TIME_SLOT_MINUTES;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
