/**
 * TurnosGrid - Google Calendar-style Time Grid
 * 
 * Features:
 * - Events positioned by actual time (top = minutes * pixelsPerMinute)
 * - Overlapping events rendered side-by-side horizontally
 * - Dynamic column width based on number of overlapping events
 * - Current time indicator with smooth scroll
 * - Click to create appointment
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ExpandedEvent, Profile } from '../types';
import {
  positionEvents,
  calculateEventLayout,
  getOverlapType,
  HOUR_HEIGHT,
  START_HOUR,
  END_HOUR,
  GRID_HEIGHT,
  MINUTE_HEIGHT,
} from '../utils/agendaOverlap';
import './TurnosGrid.css';

interface TurnosGridProps {
  currentDate: Date;
  events: ExpandedEvent[];
  profiles: Profile[];
  onSlotClick?: (time: string) => void;
  onEventClick?: (event: ExpandedEvent) => void;
}

export function TurnosGrid({
  currentDate,
  events,
  profiles,
  onSlotClick,
  onEventClick,
}: TurnosGridProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
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

  // Position all events with overlap calculation
  const positionedEvents = useMemo(() => {
    return positionEvents(daysEvents);
  }, [daysEvents]);

  // Get profile for event
  const getEventProfile = useCallback((event: ExpandedEvent): Profile | null => {
    if (!event.assignedProfileIds || event.assignedProfileIds.length === 0) {
      return null;
    }
    return profiles.find(p => p.id === event.assignedProfileIds[0]) || null;
  }, [profiles]);

  // Render hour labels
  const hourLabels = useMemo(() => {
    const labels = [];
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      labels.push(
        <div
          key={hour}
          className="turnos-hour-label"
          style={{ height: `${HOUR_HEIGHT}px` }}
        >
          {format(new Date(2024, 0, 1, hour), 'HH:00')}
        </div>
      );
    }
    return labels;
  }, []);

  // Render time slots (clickable areas)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      for (let slot = 0; slot < 4; slot++) { // 15-minute slots
        const minutes = slot * 15;
        const time = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const isCurrentSlot = isToday(currentDate) && 
          format(currentTime, 'HH:mm') === time;

        slots.push(
          <div
            key={`${hour}-${slot}`}
            className={`turnos-time-slot ${isCurrentSlot ? 'turnos-time-slot-current' : ''}`}
            data-slot-time={time}
            onClick={() => onSlotClick?.(time)}
          >
            {slot === 0 && (
              <span className="turnos-slot-time">{time}</span>
            )}
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
        {/* Hour labels */}
        <div className="turnos-hour-labels">
          {hourLabels}
        </div>

        {/* Time slots background */}
        <div className="turnos-time-slots">
          {timeSlots}
        </div>

        {/* Events positioned by time */}
        <div className="turnos-events-layer">
          {positionedEvents.map(({ event, column, totalColumns, position }) => {
            const profile = getEventProfile(event);
            const eventColor = event.color || profile?.avatarColor || '#1E88E5';
            const { left, width } = calculateEventLayout(column, totalColumns);
            const overlapType = getOverlapType(event, daysEvents);

            // Skip events completely outside visible hours
            if (position.top >= GRID_HEIGHT || position.top + position.height <= 0) {
              return null;
            }

            return (
              <button
                key={event.id}
                className={`turnos-event-card turnos-event-${overlapType} ${focusedEventId === event.id ? 'turnos-event-focused' : ''} ${focusedEventId && focusedEventId !== event.id ? 'turnos-event-dimmed' : ''}`}
                style={{
                  '--event-color': eventColor,
                  '--event-top': `${position.top}px`,
                  '--event-height': `${position.height}px`,
                  '--event-left': left,
                  '--event-width': width,
                } as React.CSSProperties}
                onClick={(e) => {
                  e.stopPropagation();
                  if (focusedEventId === event.id) {
                    onEventClick?.(event);
                    return;
                  }
                  setFocusedEventId(event.id);
                }}
                title={`${event.title}\n${format(event.startDate, 'HH:mm')} - ${format(event.endDate, 'HH:mm')}`}
              >
                <div className="turnos-event-time">
                  {format(event.startDate, 'HH:mm')} - {format(event.endDate, 'HH:mm')}
                </div>
                <div className="turnos-event-content">
                  <span className="turnos-event-title">{event.title}</span>
                  {profile && (
                    <span
                      className="turnos-event-profile"
                      style={{ backgroundColor: profile.avatarColor }}
                      title={profile.name}
                    >
                      {profile.initials}
                    </span>
                  )}
                </div>
                {focusedEventId === event.id && (
                  <div className="turnos-event-expanded">
                    {event.notes ? <div>📝 {event.notes}</div> : null}
                    {event.location ? <div>📍 {event.location}</div> : null}
                    <div>Toque de nuevo para abrir acciones</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Current time line */}
        {isToday(currentDate) && (
          <div
            className="turnos-current-time-line"
            style={{
              top: `${((currentTime.getHours() - START_HOUR) * 60 + currentTime.getMinutes()) * MINUTE_HEIGHT}px`,
            }}
          >
            <span className="current-time-label">
              {format(currentTime, 'HH:mm')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
