import { RRule, rrulestr } from 'rrule';
import type { Event, ExpandedEvent } from '../types';

/**
 * Expande los eventos recurrentes para un rango de fechas dado
 */
export function expandRecurringEvents(
  events: Event[],
  startDate: Date,
  endDate: Date
): ExpandedEvent[] {
  const expanded: ExpandedEvent[] = [];

  for (const event of events) {
    if (event.rrule) {
      try {
        const rule = rrulestr(event.rrule, {
          dtstart: new Date(event.startDate),
        });

        const occurrences = rule.between(startDate, endDate, true);

        for (const occurrence of occurrences) {
          const duration = new Date(event.endDate).getTime() - new Date(event.startDate).getTime();
          const occEnd = new Date(occurrence.getTime() + duration);

          expanded.push({
            id: `${event.id}-${occurrence.toISOString()}`,
            baseEventId: event.id,
            title: event.title,
            allDay: event.allDay,
            startDate: occurrence,
            endDate: occEnd,
            location: event.location,
            notes: event.notes,
            assignedProfileIds: event.assignedProfileIds,
            color: event.color,
            isRecurring: true,
            originalDate: occurrence,
          });
        }
      } catch (error) {
        console.error('Error expanding RRULE:', error);
      }
    } else {
      // Evento no recurrente - verificar si está en el rango
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);

      if (eventStart <= endDate && eventEnd >= startDate) {
        expanded.push({
          id: event.id,
          baseEventId: event.id,
          title: event.title,
          allDay: event.allDay,
          startDate: eventStart,
          endDate: eventEnd,
          location: event.location,
          notes: event.notes,
          assignedProfileIds: event.assignedProfileIds,
          color: event.color,
          isRecurring: false,
        });
      }
    }
  }

  // Ordenar por fecha de inicio
  expanded.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return expanded;
}

/**
 * Genera una regla RRULE basada en el patrón seleccionado
 */
export function generateRRule(
  pattern: string,
  startDate: Date,
  endDate?: Date,
  count?: number
): string | undefined {
  if (pattern === 'none') return undefined;

  const freqMap: Record<string, number> = {
    daily: 3,
    weekly: 2,
    monthly: 1,
    yearly: 0,
  };

  const options: {
    freq: number;
    dtstart: Date;
    until?: Date;
    count?: number;
  } = {
    freq: freqMap[pattern] ?? 3,
    dtstart: startDate,
  };

  if (endDate) {
    options.until = endDate;
  } else if (count) {
    options.count = count;
  } else {
    // Por defecto, repetir 52 veces (1 año para semanal, etc.)
    options.count = 52;
  }

  const rule = new RRule(options);
  return rule.toString();
}

/**
 * Obtiene las ocurrencias futuras de un evento recurrente
 */
export function getFutureOccurrences(
  event: Event,
  fromDate: Date = new Date(),
  maxCount: number = 52
): Date[] {
  if (!event.rrule) return [];

  try {
    const rule = rrulestr(event.rrule, {
      dtstart: new Date(event.startDate),
    });

    return rule.all((date, count) => {
      if (date < fromDate) return false;
      return count < maxCount;
    });
  } catch (error) {
    console.error('Error getting future occurrences:', error);
    return [];
  }
}
