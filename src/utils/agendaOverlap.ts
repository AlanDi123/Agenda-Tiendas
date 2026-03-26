/**
 * Agenda Overlap Calculation Utilities
 * Google Calendar-style event positioning and collision detection
 * 
 * This module handles:
 * - Time to pixel conversion
 * - Overlap detection
 * - Conflict group creation
 * - Column assignment for overlapping events
 */

import type { ExpandedEvent } from '../types';

// ============================================
// CONSTANTS
// ============================================

export const HOUR_HEIGHT = 64; // pixels per hour
export const MINUTE_HEIGHT = HOUR_HEIGHT / 60; // pixels per minute
export const START_HOUR = 6; // 6:00 AM
export const END_HOUR = 23; // 11:00 PM
export const VISIBLE_HOURS = END_HOUR - START_HOUR;
export const GRID_HEIGHT = VISIBLE_HOURS * HOUR_HEIGHT; // Total grid height in pixels

// ============================================
// TIME CONVERSION UTILITIES
// ============================================

/**
 * Convert time to minutes since midnight
 */
export function timeToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Convert minutes since midnight to pixels from top of grid
 */
export function minutesToPixels(minutes: number): number {
  return minutes * MINUTE_HEIGHT;
}

/**
 * Calculate event position and dimensions in pixels
 */
export function calculateEventPosition(event: ExpandedEvent): {
  top: number;
  height: number;
  startMinutes: number;
  endMinutes: number;
} {
  const startMinutes = timeToMinutes(event.startDate);
  const endMinutes = timeToMinutes(event.endDate);
  const durationMinutes = endMinutes - startMinutes;

  // Calculate position relative to START_HOUR
  const startMinutesFromVisible = startMinutes - (START_HOUR * 60);
  
  const top = minutesToPixels(startMinutesFromVisible);
  const height = minutesToPixels(durationMinutes);

  return {
    top: Math.max(0, top),
    height: Math.max(24, height), // Minimum height for visibility
    startMinutes,
    endMinutes,
  };
}

// ============================================
// OVERLAP DETECTION
// ============================================

/**
 * Check if two events overlap in time
 * Two events overlap if one starts before the other ends
 */
export function eventsOverlap(event1: ExpandedEvent, event2: ExpandedEvent): boolean {
  const start1 = timeToMinutes(event1.startDate);
  const end1 = timeToMinutes(event1.endDate);
  const start2 = timeToMinutes(event2.startDate);
  const end2 = timeToMinutes(event2.endDate);

  // Events overlap if: start1 < end2 AND start2 < end1
  return start1 < end2 && start2 < end1;
}

/**
 * Check if event is within visible hours
 */
export function isEventVisible(event: ExpandedEvent): boolean {
  const startMinutes = timeToMinutes(event.startDate);
  const endMinutes = timeToMinutes(event.endDate);
  const visibleStart = START_HOUR * 60;
  const visibleEnd = END_HOUR * 60;

  // Event is visible if it overlaps with visible hours
  return startMinutes < visibleEnd && endMinutes > visibleStart;
}

// ============================================
// CONFLICT GROUPING
// ============================================

export interface PositionedEvent {
  event: ExpandedEvent;
  column: number;
  totalColumns: number;
  position: {
    top: number;
    height: number;
  };
}

/**
 * Group overlapping events into conflict groups
 * Uses a greedy algorithm to find all overlapping events
 */
export function groupOverlappingEvents(events: ExpandedEvent[]): ExpandedEvent[][] {
  const groups: ExpandedEvent[][] = [];
  const processed = new Set<string>();

  // Filter to only visible events
  const visibleEvents = events.filter(isEventVisible);

  for (const event of visibleEvents) {
    if (processed.has(event.id)) continue;

    const group: ExpandedEvent[] = [event];
    processed.add(event.id);

    // Find all events that overlap with any event in this group
    for (const other of visibleEvents) {
      if (processed.has(other.id)) continue;

      // Check if this event overlaps with any event in the group
      for (const _ of group) {
        if (eventsOverlap(_, other)) {
          group.push(other);
          processed.add(other.id);
          break;
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Calculate column positions for overlapping events
 * Uses a greedy algorithm to assign columns
 * 
 * Algorithm:
 * 1. Sort events by start time
 * 2. For each event, try to place it in an existing column
 * 3. If no column fits, create a new column
 * 4. Event fits in column if it doesn't overlap with last event in column
 */
export function calculateEventColumns(
  group: ExpandedEvent[]
): Map<string, { column: number; totalColumns: number }> {
  const result = new Map<string, { column: number; totalColumns: number }>();

  // Sort by start time
  const sorted = [...group].sort((a, b) => {
    const aStart = timeToMinutes(a.startDate);
    const bStart = timeToMinutes(b.startDate);
    return aStart - bStart;
  });

  // Columns: each column is an array of events
  const columns: ExpandedEvent[][] = [];

  for (const event of sorted) {
    const eventStart = timeToMinutes(event.startDate);

    let placed = false;

    // Try to place in existing column
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const column = columns[colIndex];
      const lastEvent = column[column.length - 1];
      const lastEnd = timeToMinutes(lastEvent.endDate);

      // Event fits if it starts after or when last event ends
      if (eventStart >= lastEnd) {
        column.push(event);
        result.set(event.id, { column: colIndex, totalColumns: columns.length });
        placed = true;
        break;
      }
    }

    // Create new column if not placed
    if (!placed) {
      columns.push([event]);
      result.set(event.id, { column: columns.length - 1, totalColumns: columns.length });
    }
  }

  return result;
}

// ============================================
// MAIN POSITIONING FUNCTION
// ============================================

/**
 * Position all events for rendering
 * Returns events with their calculated positions and column assignments
 */
export function positionEvents(events: ExpandedEvent[]): PositionedEvent[] {
  // Group overlapping events
  const groups = groupOverlappingEvents(events);

  const positioned: PositionedEvent[] = [];

  for (const group of groups) {
    // Calculate columns for this group
    const columnMap = calculateEventColumns(group);

    // Create positioned events
    for (const event of group) {
      const columnData = columnMap.get(event.id);
      if (!columnData) continue;

      const position = calculateEventPosition(event);

      positioned.push({
        event,
        column: columnData.column,
        totalColumns: columnData.totalColumns,
        position,
      });
    }
  }

  // Sort by start time for consistent rendering
  return positioned.sort((a, b) => {
    const aStart = timeToMinutes(a.event.startDate);
    const bStart = timeToMinutes(b.event.startDate);
    return aStart - bStart;
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get events for a specific hour
 */
export function getEventsForHour(
  events: ExpandedEvent[],
  hour: number
): ExpandedEvent[] {
  const hourStart = hour * 60;
  const hourEnd = (hour + 1) * 60;

  return events.filter(event => {
    const start = timeToMinutes(event.startDate);
    const end = timeToMinutes(event.endDate);
    return start < hourEnd && end > hourStart;
  });
}

/**
 * Calculate event width and left position based on column
 */
export function calculateEventLayout(
  column: number,
  totalColumns: number
): {
  left: string;
  width: string;
} {
  const widthPercent = 100 / totalColumns;
  const leftPercent = column * widthPercent;

  return {
    left: `calc(${leftPercent}%)`,
    width: `calc(${widthPercent}% - 4px)`, // 4px gap between events
  };
}

/**
 * Get overlap type for styling
 */
export type OverlapType = 'single' | 'partial' | 'full';

export function getOverlapType(
  event: ExpandedEvent,
  allEvents: ExpandedEvent[]
): OverlapType {
  const overlappingEvents = allEvents.filter(e => 
    e.id !== event.id && eventsOverlap(event, e)
  );

  if (overlappingEvents.length === 0) {
    return 'single';
  }

  // Check if overlap is partial or full
  const eventStart = timeToMinutes(event.startDate);
  const eventEnd = timeToMinutes(event.endDate);

  let hasPartialOverlap = false;

  for (const other of overlappingEvents) {
    const otherStart = timeToMinutes(other.startDate);
    const otherEnd = timeToMinutes(other.endDate);

    // Partial overlap: one starts during the other but doesn't fully contain it
    if (
      (otherStart > eventStart && otherStart < eventEnd) ||
      (otherEnd > eventStart && otherEnd < eventEnd)
    ) {
      hasPartialOverlap = true;
      break;
    }
  }

  return hasPartialOverlap ? 'partial' : 'full';
}

// Export type for use in components
export const OVERLAP_TYPE: { SINGLE: 'single'; PARTIAL: 'partial'; FULL: 'full' } = {
  SINGLE: 'single',
  PARTIAL: 'partial',
  FULL: 'full',
};

// ============================================
// EXAMPLES
// ============================================

/**
 * Example usage:
 * 
 * const events = [
 *   { id: '1', startDate: new Date('2024-01-15T20:00:00'), endDate: new Date('2024-01-15T21:00:00'), ... },
 *   { id: '2', startDate: new Date('2024-01-15T20:30:00'), endDate: new Date('2024-01-15T21:30:00'), ... },
 * ];
 * 
 * const positioned = positionEvents(events);
 * 
 * // Result:
 * // Event 1: column 0, totalColumns 2, top: 896px (14 hours * 64px), height: 64px
 * // Event 2: column 1, totalColumns 2, top: 928px (14.5 hours * 64px), height: 64px
 * 
 * // Render:
 * positioned.forEach(({ event, column, totalColumns, position }) => {
 *   const { left, width } = calculateEventLayout(column, totalColumns);
 *   // Render event with style={{ top: position.top, height: position.height, left, width }}
 * });
 */
