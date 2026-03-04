// Event Service
// Handles event operations including overlap detection

import type { Event } from '../types';

/**
 * Check if two events overlap in time
 */
export function eventsOverlap(event1: Pick<Event, 'startDate' | 'endDate'>, event2: Pick<Event, 'startDate' | 'endDate'>): boolean {
  const start1 = new Date(event1.startDate).getTime();
  const end1 = new Date(event1.endDate).getTime();
  const start2 = new Date(event2.startDate).getTime();
  const end2 = new Date(event2.endDate).getTime();

  // Events overlap if one starts before the other ends
  return start1 < end2 && start2 < end1;
}

/**
 * Check if a new event overlaps with existing events
 * Returns array of overlapping events
 */
export function checkEventOverlap(
  events: Array<Pick<Event, 'id' | 'startDate' | 'endDate' | 'title'>>,
  newEvent: Pick<Event, 'startDate' | 'endDate'>,
  excludeEventId?: string
): Array<Pick<Event, 'id' | 'startDate' | 'endDate' | 'title'>> {
  return events.filter(event => {
    if (excludeEventId && event.id === excludeEventId) {
      return false;
    }
    return eventsOverlap(event, newEvent);
  });
}

/**
 * Suggest an alternative time slot that doesn't conflict
 */
export function suggestAlternativeTime(
  events: Array<Pick<Event, 'startDate' | 'endDate'>>,
  preferredStart: Date,
  durationMinutes: number = 60
): Date | null {
  const preferredStartTime = preferredStart.getTime();
  
  // Check if preferred time is available
  const preferredEnd = new Date(preferredStartTime + (durationMinutes * 60 * 1000));
  const hasOverlap = events.some(event => 
    eventsOverlap(
      { startDate: preferredStart, endDate: preferredEnd },
      event
    )
  );

  if (!hasOverlap) {
    return preferredStart;
  }

  // Try to find next available slot (check every 30 minutes for next 24 hours)
  const msPerMinute = 60 * 1000;
  const searchEnd = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
  
  let candidateStart = preferredStartTime + (30 * msPerMinute);
  
  while (candidateStart < searchEnd) {
    const candidateEnd = candidateStart + (durationMinutes * msPerMinute);
    const candidateEvent = { startDate: new Date(candidateStart), endDate: new Date(candidateEnd) };
    
    const hasConflict = events.some(event => eventsOverlap(candidateEvent, event));
    
    if (!hasConflict) {
      return new Date(candidateStart);
    }
    
    candidateStart += (30 * msPerMinute);
  }

  return null; // No available slot found
}

/**
 * Get events for a specific date range
 */
export function filterEventsByDateRange(
  events: Event[],
  startDate: Date,
  endDate: Date
): Event[] {
  return events.filter(event => {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);
    return eventStart <= endDate && eventEnd >= startDate;
  });
}

/**
 * Sort events by start date
 */
export function sortEventsByDate(events: Event[]): Event[] {
  return [...events].sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
}

/**
 * Group events by date
 */
export function groupEventsByDate(events: Event[]): Map<string, Event[]> {
  const grouped = new Map<string, Event[]>();
  
  for (const event of events) {
    const dateKey = new Date(event.startDate).toISOString().split('T')[0];
    const existing = grouped.get(dateKey) || [];
    existing.push(event);
    grouped.set(dateKey, existing);
  }
  
  return grouped;
}

/**
 * Check if event has alarms that should trigger
 */
export function getDueAlarms(event: Event, currentTime: Date = new Date()): Event['alarms'] {
  if (!event.alarms) return [];
  
  return event.alarms.filter(alarm => {
    if (alarm.triggered) return false;
    
    const alarmTime = new Date(event.startDate);
    alarmTime.setMinutes(alarmTime.getMinutes() - alarm.minutesBefore);
    
    return alarmTime <= currentTime;
  });
}

/**
 * Mark alarm as triggered
 */
export function markAlarmTriggered(event: Event, alarmId: string): Event {
  if (!event.alarms) return event;
  
  return {
    ...event,
    alarms: event.alarms.map(alarm =>
      alarm.id === alarmId
        ? { ...alarm, triggered: true, triggeredAt: new Date() }
        : alarm
    ),
    updatedAt: new Date(),
  };
}
