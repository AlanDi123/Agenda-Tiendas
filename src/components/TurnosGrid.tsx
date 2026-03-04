// Enhanced TurnosGrid with Google Calendar-style time positioning and overlap handling
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

const HOUR_HEIGHT = 64; // pixels per hour
const START_HOUR = 6; // 6:00 AM
const END_HOUR = 23; // 11:00 PM
const VISIBLE_HOURS = END_HOUR - START_HOUR;
const MINUTES_PER_SLOT = 15;
const SLOTS_PER_HOUR = 60 / MINUTES_PER_SLOT;

// Calculate event position and dimensions
function calculateEventPosition(event: ExpandedEvent) {
  const startHour = event.startDate.getHours();
  const startMinute = event.startDate.getMinutes();
  const endHour = event.endDate.getHours();
  const endMinute = event.endDate.getMinutes();

  // Minutes from start of visible day (START_HOUR)
  const startMinutesFromVisible = (startHour - START_HOUR) * 60 + startMinute;
  const endMinutesFromVisible = (endHour - START_HOUR) * 60 + endMinute;

  // Pixel position
  const top = (startMinutesFromVisible / 60) * HOUR_HEIGHT;
  const height = ((endMinutesFromVisible - startMinutesFromVisible) / 60) * HOUR_HEIGHT;

  return {
    top: Math.max(0, top),
    height: Math.max(24, height), // Minimum height for visibility
    startMinutes: startMinutesFromVisible,
    endMinutes: endMinutesFromVisible,
  };
}

// Check if two events overlap in time
function eventsOverlap(e1: ExpandedEvent, e2: ExpandedEvent): boolean {
  const e1Start = e1.startDate.getHours() * 60 + e1.startDate.getMinutes();
  const e1End = e1.endDate.getHours() * 60 + e1.endDate.getMinutes();
  const e2Start = e2.startDate.getHours() * 60 + e2.startDate.getMinutes();
  const e2End = e2.endDate.getHours() * 60 + e2.endDate.getMinutes();

  return e1Start < e2End && e2Start < e1End;
}

// Group overlapping events into collision groups
function groupOverlappingEvents(events: ExpandedEvent[]): ExpandedEvent[][] {
  const groups: ExpandedEvent[][] = [];
  const processed = new Set<string>();

  for (const event of events) {
    if (processed.has(event.id)) continue;

    const group: ExpandedEvent[] = [event];
    processed.add(event.id);

    for (const other of events) {
      if (processed.has(other.id)) continue;
      if (eventsOverlap(event, other)) {
        group.push(other);
        processed.add(other.id);
      }
    }

    groups.push(group);
  }

  return groups;
}

// Calculate column positions for overlapping events
function calculateEventColumns(group: ExpandedEvent[]): Map<string, { column: number; totalColumns: number }> {
  const result = new Map<string, { column: number; totalColumns: number }>();
  
  // Sort by start time
  const sorted = [...group].sort((a, b) => {
    const aStart = a.startDate.getHours() * 60 + a.startDate.getMinutes();
    const bStart = b.startDate.getHours() * 60 + b.startDate.getMinutes();
    return aStart - bStart;
  });

  // Greedy algorithm to assign columns
  const columns: ExpandedEvent[][] = [];

  for (const event of sorted) {
    const eventStart = event.startDate.getHours() * 60 + event.startDate.getMinutes();

    let placed = false;

    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const column = columns[colIndex];
      const lastEvent = column[column.length - 1];
      const lastEnd = lastEvent.endDate.getHours() * 60 + lastEvent.endDate.getMinutes();

      // If no overlap with last event in this column
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

  return result;
}

export function TurnosGrid({
  currentDate,
  events,
  profiles,
  onSlotClick,
  onEventClick,
}: TurnosGridProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const gridRef = useRef<HTMLDivElement>(null);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Scroll to current time when date changes
  useEffect(() => {
    if (isToday(currentDate) && gridRef.current) {
      const currentHour = currentTime.getHours();
      if (currentHour >= START_HOUR && currentHour < END_HOUR) {
        const scrollPosition = (currentHour - START_HOUR) * HOUR_HEIGHT;
        gridRef.current.scrollTo({
          top: Math.max(0, scrollPosition - 100),
          behavior: 'smooth',
        });
      }
    }
  }, [currentDate, currentTime]);

  // Filter events for current date
  const daysEvents = useMemo(() => {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    return events.filter(event => {
      const eventDate = format(event.startDate, 'yyyy-MM-dd');
      return eventDate === dateStr;
    });
  }, [events, currentDate]);

  // Group overlapping events and calculate positions
  const positionedEvents = useMemo(() => {
    const groups = groupOverlappingEvents(daysEvents);
    const positionMap = new Map<string, { event: ExpandedEvent; column: number; totalColumns: number }>();

    for (const group of groups) {
      const columns = calculateEventColumns(group);
      columns.forEach((data, eventId) => {
        const event = group.find(e => e.id === eventId);
        if (event) {
          positionMap.set(eventId, {
            event,
            column: data.column,
            totalColumns: data.totalColumns,
          });
        }
      });
    }

    return Array.from(positionMap.values());
  }, [daysEvents]);

  // Get profile for event
  const getEventProfile = useCallback((event: ExpandedEvent): Profile | null => {
    if (!event.assignedProfileIds || event.assignedProfileIds.length === 0) {
      return null;
    }
    return profiles.find(p => p.id === event.assignedProfileIds[0]) || null;
  }, [profiles]);

  // Render time slots
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      for (let slot = 0; slot < SLOTS_PER_HOUR; slot++) {
        const time = `${hour.toString().padStart(2, '0')}:${(slot * MINUTES_PER_SLOT).toString().padStart(2, '0')}`;
        const isCurrentSlot = isToday(currentDate) && format(currentTime, 'HH:mm') === time;

        slots.push(
          <div
            key={`${hour}-${slot}`}
            className={`turno-slot ${isCurrentSlot ? 'turno-slot-current' : ''}`}
            data-slot-time={time}
            onClick={() => onSlotClick?.(time)}
          >
            <div className="turno-slot-time">{time}</div>
            <div className="turno-slot-content">
              <span className="turno-slot-available">Disponible</span>
            </div>
          </div>
        );
      }
    }
    return slots;
  }, [currentDate, currentTime, onSlotClick]);

  return (
    <div className="turnos-grid-container">
      <div className="turnos-grid-header">
        <h3 className="turnos-grid-title">
          📋 Turnos del {format(currentDate, "EEEE, d 'de' MMMM", { locale: es })}
        </h3>
      </div>

      <div className="turnos-grid" ref={gridRef}>
        {/* Time slots background */}
        {timeSlots}

        {/* Events positioned by time */}
        {positionedEvents.map(({ event, column, totalColumns }) => {
          const position = calculateEventPosition(event);
          const profile = getEventProfile(event);
          const eventColor = event.color || profile?.avatarColor || '#1E88E5';
          const widthPercent = 100 / totalColumns;
          const leftPercent = column * widthPercent;

          // Skip events outside visible hours
          if (position.startMinutes < 0 || position.startMinutes >= VISIBLE_HOURS * 60) {
            return null;
          }

          return (
            <button
              key={event.id}
              className="turno-event-card"
              style={{
                '--event-color': eventColor,
                '--event-top': `${position.top}px`,
                '--event-height': `${position.height}px`,
                '--event-left': `calc(${leftPercent}%)`,
                '--event-width': `calc(${widthPercent}% - 4px)`,
              } as React.CSSProperties}
              onClick={(e) => {
                e.stopPropagation();
                onEventClick?.(event);
              }}
            >
              <div className="turno-event-time">
                {format(event.startDate, 'HH:mm')} - {format(event.endDate, 'HH:mm')}
              </div>
              <div className="turno-event-content">
                <span className="turno-event-title">{event.title}</span>
                {profile && (
                  <span
                    className="turno-event-profile"
                    style={{ backgroundColor: profile.avatarColor }}
                  >
                    {profile.initials}
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {/* Current time line */}
        {isToday(currentDate) && (
          <div
            className="turnos-current-time-line"
            style={{
              top: `${((currentTime.getHours() - START_HOUR) * 60 + currentTime.getMinutes()) / 60 * HOUR_HEIGHT}px`,
            }}
          >
            <span className="current-time-label">{format(currentTime, 'HH:mm')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
