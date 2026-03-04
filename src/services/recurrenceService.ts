// Series-Based Recurrence Service
// Handles recurring events with proper exception management

import { RRule, rrulestr } from 'rrule';
import type { Event, ExpandedEvent, EventCategory } from '../types';

export interface RecurrenceSeries {
  id: string; // Series ID (same as base event ID)
  rrule: string;
  startDate: Date;
  endDate: Date;
  title: string;
  notes?: string;
  location?: string;
  color: string;
  category?: string;
  assignedProfileIds: string[];
  exceptions: RecurrenceException[];
}

export interface RecurrenceException {
  id: string; // Exception ID
  originalDate: Date; // Date of the occurrence being modified
  type: 'deleted' | 'modified';
  modifiedEvent?: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>; // For modified occurrences
}

export type EditScope = 'single' | 'future' | 'all';

/**
 * Create a recurrence series from an event
 */
export function createRecurrenceSeries(event: Event): RecurrenceSeries {
  if (!event.rrule) {
    throw new Error('Event is not recurring');
  }

  return {
    id: event.id,
    rrule: event.rrule,
    startDate: new Date(event.startDate),
    endDate: new Date(event.endDate),
    title: event.title,
    notes: event.notes,
    location: event.location,
    color: event.color,
    category: event.category,
    assignedProfileIds: event.assignedProfileIds,
    exceptions: [],
  };
}

/**
 * Expand a recurrence series for a date range
 */
export function expandSeries(
  series: RecurrenceSeries,
  rangeStart: Date,
  rangeEnd: Date
): ExpandedEvent[] {
  const expanded: ExpandedEvent[] = [];

  try {
    // Parse the RRULE
    const rule = rrulestr(series.rrule, {
      dtstart: series.startDate,
    });

    // Get all occurrences in the range
    const occurrences = rule.between(rangeStart, rangeEnd, true);

    for (const occurrence of occurrences) {
      // Check if this occurrence has an exception
      const exception = series.exceptions.find(
        ex => ex.originalDate.toISOString() === occurrence.toISOString()
      );

      if (exception?.type === 'deleted') {
        // Skip deleted occurrences
        continue;
      }

      const duration = series.endDate.getTime() - series.startDate.getTime();
      const occEnd = new Date(occurrence.getTime() + duration);

      if (exception?.type === 'modified' && exception.modifiedEvent) {
        // Use modified event data
        expanded.push({
          id: `${series.id}-${occurrence.toISOString()}`,
          baseEventId: series.id,
          title: exception.modifiedEvent.title,
          phone: exception.modifiedEvent.phone,
          allDay: exception.modifiedEvent.allDay,
          startDate: occurrence,
          endDate: occEnd,
          location: exception.modifiedEvent.location ?? series.location,
          notes: exception.modifiedEvent.notes ?? series.notes,
          assignedProfileIds: exception.modifiedEvent.assignedProfileIds,
          color: exception.modifiedEvent.color,
          category: exception.modifiedEvent.category,
          isRecurring: true,
          originalDate: occurrence,
          alarms: exception.modifiedEvent.alarms,
          createdBy: exception.modifiedEvent.createdBy,
          lastModifiedBy: exception.modifiedEvent.lastModifiedBy,
        });
      } else {
        // Use series data
        expanded.push({
          id: `${series.id}-${occurrence.toISOString()}`,
          baseEventId: series.id,
          title: series.title,
          phone: eventPhoneFromSeries(series),
          allDay: isAllDaySeries(series),
          startDate: occurrence,
          endDate: occEnd,
          location: series.location,
          notes: series.notes,
          assignedProfileIds: series.assignedProfileIds,
          color: series.color,
          category: series.category as EventCategory | undefined,
          isRecurring: true,
          originalDate: occurrence,
          alarms: [],
        });
      }
    }
  } catch (error) {
    console.error('Error expanding series:', error);
  }

  expanded.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return expanded;
}

// Helper functions (these would use actual event data in production)
function eventPhoneFromSeries(_series: RecurrenceSeries): string | undefined {
  // In production, this would come from the series data
  return undefined;
}

function isAllDaySeries(_series: RecurrenceSeries): boolean {
  // In production, this would come from the series data
  return false;
}

/**
 * Add an exception to a series (for single instance edits)
 */
export function addException(
  series: RecurrenceSeries,
  occurrenceDate: Date,
  type: 'deleted' | 'modified',
  modifiedData?: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>
): RecurrenceSeries {
  const exception: RecurrenceException = {
    id: `${series.id}-exception-${occurrenceDate.toISOString()}`,
    originalDate: occurrenceDate,
    type,
    modifiedEvent: modifiedData,
  };

  return {
    ...series,
    exceptions: [...series.exceptions, exception],
  };
}

/**
 * Remove an exception from a series
 */
export function removeException(
  series: RecurrenceSeries,
  occurrenceDate: Date
): RecurrenceSeries {
  return {
    ...series,
    exceptions: series.exceptions.filter(
      ex => ex.originalDate.toISOString() !== occurrenceDate.toISOString()
    ),
  };
}

/**
 * Handle editing a recurring event with scope
 * Returns: updated series and/or new standalone event
 */
export function editRecurringEvent(
  series: RecurrenceSeries,
  occurrenceDate: Date,
  newData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>,
  scope: EditScope
): {
  updatedSeries?: RecurrenceSeries;
  newEvent?: Event;
  deletedSeries?: RecurrenceSeries;
} {
  switch (scope) {
    case 'single': {
      // Create an exception for this single occurrence
      const updatedSeries = addException(series, occurrenceDate, 'modified', newData);
      return { updatedSeries };
    }

    case 'future': {
      // Split the series: keep old occurrences, create new series for future
      // Create new series starting from this occurrence
      const newSeries: RecurrenceSeries = {
        ...series,
        id: `${series.id}-split-${Date.now()}`,
        exceptions: [],
      };

      // Add exception to old series for this and future occurrences
      const updatedOldSeries = addException(series, occurrenceDate, 'deleted');

      // If there are changes, apply them to the new series
      if (newData.title !== series.title || newData.notes !== series.notes) {
        newSeries.title = newData.title;
        newSeries.notes = newData.notes;
        newSeries.location = newData.location;
        newSeries.color = newData.color;
        newSeries.assignedProfileIds = newData.assignedProfileIds;
      }

      return {
        updatedSeries: updatedOldSeries,
        newEvent: {
          ...newData,
          id: newSeries.id,
          rrule: newSeries.rrule,
          startDate: occurrenceDate,
          endDate: new Date(occurrenceDate.getTime() + (series.endDate.getTime() - series.startDate.getTime())),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Event,
      };
    }

    case 'all': {
      // Update the entire series
      const updatedSeries: RecurrenceSeries = {
        ...series,
        title: newData.title,
        notes: newData.notes,
        location: newData.location,
        color: newData.color,
        assignedProfileIds: newData.assignedProfileIds,
        category: newData.category,
      };
      return { updatedSeries };
    }

    default:
      return {};
  }
}

/**
 * Delete a recurring event with scope
 */
export function deleteRecurringEvent(
  series: RecurrenceSeries,
  occurrenceDate: Date,
  scope: EditScope
): {
  updatedSeries?: RecurrenceSeries;
  deletedSeries?: RecurrenceSeries;
} {
  switch (scope) {
    case 'single': {
      // Add a deleted exception for this occurrence
      const updatedSeries = addException(series, occurrenceDate, 'deleted');
      return { updatedSeries };
    }

    case 'future': {
      // Add deleted exception for this and all future occurrences
      const updatedSeries = addException(series, occurrenceDate, 'deleted');
      return { updatedSeries };
    }

    case 'all': {
      // Delete the entire series
      return { deletedSeries: series };
    }

    default:
      return {};
  }
}

/**
 * Get all future occurrences of a series
 */
export function getFutureOccurrences(
  series: RecurrenceSeries,
  fromDate: Date = new Date(),
  maxCount: number = 52
): Date[] {
  try {
    const rule = rrulestr(series.rrule, {
      dtstart: series.startDate,
    });

    return rule.all((date, count) => {
      if (date < fromDate) return false;
      
      // Check if this date is a deleted exception
      const isDeleted = series.exceptions.some(
        ex => ex.type === 'deleted' && ex.originalDate.toISOString() === date.toISOString()
      );
      if (isDeleted) return false;

      return count < maxCount;
    });
  } catch (error) {
    console.error('Error getting future occurrences:', error);
    return [];
  }
}

/**
 * Convert legacy event to series format
 */
export function eventToSeries(event: Event): RecurrenceSeries | null {
  if (!event.rrule) return null;

  return {
    id: event.id,
    rrule: event.rrule,
    startDate: new Date(event.startDate),
    endDate: new Date(event.endDate),
    title: event.title,
    notes: event.notes,
    location: event.location,
    color: event.color,
    category: event.category,
    assignedProfileIds: event.assignedProfileIds,
    exceptions: [],
  };
}

/**
 * Generate human-readable recurrence description
 */
export function getRecurrenceDescription(rrule: string): string {
  try {
    const rule = RRule.fromString(rrule);
    const options = rule.origOptions;

    const freqText: Record<string, string> = {
      YEARLY: 'anual',
      MONTHLY: 'mensual',
      WEEKLY: 'semanal',
      DAILY: 'diario',
      HOURLY: 'cada hora',
      MINUTELY: 'cada minuto',
      SECONDLY: 'cada segundo',
    };

    const freq = freqText[options.freq?.toString() || 'DAILY'] || 'regular';

    if (options.count) {
      return `Se repite ${freq} (${options.count} veces)`;
    }

    if (options.until) {
      const untilDate = new Date(options.until);
      return `Se repite ${freq} (hasta ${untilDate.toLocaleDateString('es-ES')})`;
    }

    return `Se repite ${freq}`;
  } catch (error) {
    return 'Evento recurrente';
  }
}
