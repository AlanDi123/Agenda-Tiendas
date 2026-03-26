import { useRef } from 'react';
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
const HOUR_HEIGHT = 64; // pixels per hour
const START_HOUR = 6; // 6:00 AM
const END_HOUR = 23; // 11:00 PM
const VISIBLE_HOURS = END_HOUR - START_HOUR;

// Check if two events overlap
function eventsOverlap(e1: ExpandedEvent, e2: ExpandedEvent): boolean {
  const e1Start = e1.startDate.getTime();
  const e1End = e1.endDate.getTime();
  const e2Start = e2.startDate.getTime();
  const e2End = e2.endDate.getTime();
  return e1Start < e2End && e2Start < e1End;
}

// Group overlapping events
function groupOverlappingEvents(events: ExpandedEvent[]): ExpandedEvent[][] {
  const groups: ExpandedEvent[][] = [];
  const processed = new Set<string>();

  const sorted = [...events].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  for (const seed of sorted) {
    if (processed.has(seed.id)) continue;

    const group: ExpandedEvent[] = [seed];
    processed.add(seed.id);

    // Expandimos el grupo mientras encontremos eventos que solapan con CUALQUIERA del grupo,
    // no solo con el primer "seed".
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const other of sorted) {
        if (processed.has(other.id)) continue;
        if (group.some((member) => eventsOverlap(member, other))) {
          group.push(other);
          processed.add(other.id);
          expanded = true;
        }
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
  const sorted = [...group].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // Greedy algorithm
  const columns: ExpandedEvent[][] = [];

  for (const event of sorted) {
    const eventStart = event.startDate.getTime();

    let placed = false;

    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const column = columns[colIndex];
      const lastEvent = column[column.length - 1];
      const lastEnd = lastEvent.endDate.getTime();

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

// Calculate event position
function calculateEventPosition(event: ExpandedEvent) {
  const startHour = event.startDate.getHours();
  const startMinute = event.startDate.getMinutes();
  const endHour = event.endDate.getHours();
  const endMinute = event.endDate.getMinutes();

  const startMinutesFromVisible = (startHour - START_HOUR) * 60 + startMinute;
  const endMinutesFromVisible = (endHour - START_HOUR) * 60 + endMinute;

  const top = (startMinutesFromVisible / 60) * HOUR_HEIGHT;
  const height = ((endMinutesFromVisible - startMinutesFromVisible) / 60) * HOUR_HEIGHT;

  return {
    top: Math.max(0, top),
    height: Math.max(24, height),
  };
}

export function WeekView({
  currentDate,
  events,
  onDayClick,
  onEventClick,
}: WeekViewProps) {
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();

  // Get Monday of current week
  const currentDay = new Date(year, month, day).getDay() || 7;
  const monday = new Date(year, month, day - (currentDay - 1));

  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }

  // Hours for the grid
  const hours = Array.from({ length: VISIBLE_HOURS }, (_, i) => i + START_HOUR);

  // Group events by day with overlap calculation
  const eventsByDay = weekDays.map((day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const dayEvents = events.filter(event => {
      const eventDate = format(event.startDate, 'yyyy-MM-dd');
      return eventDate === dayKey;
    });

    // Calculate overlap positions
    const groups = groupOverlappingEvents(dayEvents);
    const positionedEvents: Array<{
      event: ExpandedEvent;
      column: number;
      totalColumns: number;
      position: { top: number; height: number };
    }> = [];

    for (const group of groups) {
      const columns = calculateEventColumns(group);
      columns.forEach((data, eventId) => {
        const event = group.find(e => e.id === eventId);
        if (event) {
          positionedEvents.push({
            event,
            column: data.column,
            totalColumns: data.totalColumns,
            position: calculateEventPosition(event),
          });
        }
      });
    }

    return {
      date: day,
      dayKey,
      events: positionedEvents,
    };
  });

  return (
    <div className="week-view">
      <div className="week-view-header-scroll" ref={headerScrollRef}>
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
      </div>

      <div
        className="week-view-grid"
        ref={gridScrollRef}
        onScroll={() => {
          if (headerScrollRef.current && gridScrollRef.current) {
            headerScrollRef.current.scrollLeft = gridScrollRef.current.scrollLeft;
          }
        }}
      >
        <div className="week-view-times">
          {hours.map(hour => (
            <div key={hour} className="week-view-time">
              {format(new Date(2024, 0, 1, hour), 'HH:00')}
            </div>
          ))}
        </div>

        {eventsByDay.map(({ date, events: positionedEvents }, dayIndex) => {
          const isTodayDate = isToday(date);

          return (
            <div
              key={dayIndex}
              className={`week-view-column ${isTodayDate ? 'week-view-column-today' : ''}`}
            >
              {/* Hour cells */}
              {hours.map(hour => (
                <div key={hour} className="week-view-cell" />
              ))}

              {/* Positioned events */}
              {positionedEvents.map(({ event, column, totalColumns, position }) => {
                const widthPercent = 100 / totalColumns;
                const leftPercent = column * widthPercent;

                return (
                  <button
                    key={event.id}
                    className="week-view-event"
                    style={{
                      top: `${position.top}px`,
                      height: `${position.height}px`,
                      backgroundColor: event.color,
                      left: `calc(${leftPercent}%)`,
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
