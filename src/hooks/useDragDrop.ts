// Enhanced Drag & Drop Hook for Event Rescheduling
// Includes duration recalculation, overlap validation, and alarm updates

import { useState, useCallback, useRef } from 'react';
import type { Event } from '../types';
import { checkEventOverlap, suggestAlternativeTime } from '../services/eventService';

export interface DragDropOptions {
  events: Event[];
  onDrop?: (date: Date, eventId: string, newEvent: Partial<Event>) => Promise<void>;
  onDragStart?: (eventId: string) => void;
  onDragEnd?: () => void;
  onOverlapDetected?: (overlappingEvents: Pick<Event, 'id' | 'startDate' | 'endDate' | 'title'>[]) => void;
  enabled?: boolean;
  snapToGrid?: '15min' | '30min' | '60min';
}

export interface DragDropResult {
  isDragging: boolean;
  draggedEventId: string | null;
  dragOverDate: Date | null;
  overlapDetected: boolean;
  overlappingEvents: Pick<Event, 'id' | 'startDate' | 'endDate' | 'title'>[];
  suggestedTime: Date | null;
  handleDragStart: (e: React.DragEvent, eventId: string) => void;
  handleDragEnd: () => void;
  handleDragOver: (e: React.DragEvent, date: Date) => void;
  handleDrop: (e: React.DragEvent, date: Date) => Promise<void>;
  calculateNewTimes: (date: Date) => { startDate: Date; endDate: Date } | null;
}

export function useDragDrop(options: DragDropOptions): DragDropResult {
  const {
    events,
    onDrop,
    onDragStart,
    onDragEnd,
    onOverlapDetected,
    enabled = true,
    snapToGrid = '15min',
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);
  const [overlapDetected, setOverlapDetected] = useState(false);
  const [overlappingEvents, setOverlappingEvents] = useState<Pick<Event, 'id' | 'startDate' | 'endDate' | 'title'>[]>([]);
  const [suggestedTime, setSuggestedTime] = useState<Date | null>(null);

  const draggedEventRef = useRef<Event | null>(null);
  const dragOverDateRef = useRef<Date | null>(null);

  // Snap time to grid
  const snapToGridTime = useCallback((date: Date): Date => {
    const snapped = new Date(date);
    const minutes = snapped.getMinutes();
    
    let snapMinutes: number;
    switch (snapToGrid) {
      case '60min':
        snapMinutes = 60;
        break;
      case '30min':
        snapMinutes = 30;
        break;
      case '15min':
      default:
        snapMinutes = 15;
        break;
    }

    snapped.setMinutes(Math.round(minutes / snapMinutes) * snapMinutes);
    snapped.setSeconds(0);
    snapped.setMilliseconds(0);

    return snapped;
  }, [snapToGrid]);

  // Calculate new start and end times maintaining duration
  const calculateNewTimes = useCallback((date: Date): { startDate: Date; endDate: Date } | null => {
    if (!draggedEventRef.current) return null;

    const originalEvent = draggedEventRef.current;
    const originalDuration = originalEvent.endDate.getTime() - originalEvent.startDate.getTime();
    
    const snappedDate = snapToGridTime(date);
    const newStartDate = snappedDate;
    const newEndDate = new Date(snappedDate.getTime() + originalDuration);

    return {
      startDate: newStartDate,
      endDate: newEndDate,
    };
  }, [snapToGridTime]);

  const handleDragStart = useCallback((e: React.DragEvent, eventId: string) => {
    if (!enabled) {
      e.preventDefault();
      return;
    }

    const event = events.find(ev => ev.id === eventId);
    if (!event) return;

    draggedEventRef.current = event;
    setIsDragging(true);
    setDraggedEventId(eventId);
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', eventId);
    e.dataTransfer.setData('application/json', JSON.stringify({
      eventId,
      startDate: event.startDate,
      endDate: event.endDate,
    }));

    // Set custom drag image
    const dragImage = document.createElement('div');
    dragImage.className = 'event-drag-image';
    dragImage.innerHTML = `
      <div class="drag-preview">
        <span class="drag-preview-title">${event.title}</span>
        <span class="drag-preview-time">${new Date(event.startDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    `;
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);

    onDragStart?.(eventId);
  }, [enabled, events, onDragStart]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedEventId(null);
    setDragOverDate(null);
    setOverlapDetected(false);
    setOverlappingEvents([]);
    setSuggestedTime(null);
    draggedEventRef.current = null;
    dragOverDateRef.current = null;
    onDragEnd?.();
  }, [onDragEnd]);

  const handleDragOver = useCallback((e: React.DragEvent, date: Date) => {
    if (!enabled || !draggedEventRef.current) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const snappedDate = snapToGridTime(date);
    
    // Only update if date changed to avoid re-renders
    if (dragOverDateRef.current?.getTime() !== snappedDate.getTime()) {
      dragOverDateRef.current = snappedDate;
      setDragOverDate(snappedDate);

      // Check for overlaps
      const newTimes = calculateNewTimes(snappedDate);
      if (newTimes && draggedEventRef.current) {
        const overlaps = checkEventOverlap(
          events,
          { startDate: newTimes.startDate, endDate: newTimes.endDate },
          draggedEventRef.current.id
        );

        if (overlaps.length > 0) {
          setOverlapDetected(true);
          setOverlappingEvents(overlaps);
          onOverlapDetected?.(overlaps);

          // Suggest alternative time
          const suggested = suggestAlternativeTime(events, snappedDate, newTimes.endDate.getTime() - newTimes.startDate.getTime());
          setSuggestedTime(suggested);
        } else {
          setOverlapDetected(false);
          setOverlappingEvents([]);
          setSuggestedTime(null);
        }
      }
    }
  }, [enabled, calculateNewTimes, events, onOverlapDetected, snapToGridTime]);

  const handleDrop = useCallback(async (e: React.DragEvent, date: Date) => {
    if (!enabled || !draggedEventRef.current) return;
    
    e.preventDefault();
    
    const snappedDate = snapToGridTime(date);
    const newTimes = calculateNewTimes(snappedDate);
    
    if (!newTimes) {
      handleDragEnd();
      return;
    }

    const eventId = draggedEventRef.current.id;
    
    // Prepare updated event data
    const updatedEventData: Partial<Event> = {
      startDate: newTimes.startDate,
      endDate: newTimes.endDate,
      updatedAt: new Date(),
    };

    // Reset alarms if time changed significantly
    if (draggedEventRef.current.alarms) {
      updatedEventData.alarms = draggedEventRef.current.alarms.map(alarm => ({
        ...alarm,
        triggered: false,
      }));
    }

    try {
      await onDrop?.(snappedDate, eventId, updatedEventData);
    } catch (error) {
      console.error('Error dropping event:', error);
    }

    handleDragEnd();
  }, [enabled, calculateNewTimes, onDrop, handleDragEnd, snapToGridTime]);

  return {
    isDragging,
    draggedEventId,
    dragOverDate,
    overlapDetected,
    overlappingEvents,
    suggestedTime,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    calculateNewTimes,
  };
}

// Helper component for drag preview styling (to be added to CSS)
export const dragPreviewStyles = `
.event-drag-image {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.8;
}

.drag-preview {
  background: var(--color-primary);
  color: white;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  min-width: 150px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drag-preview-title {
  font-size: 0.875rem;
  font-weight: 600;
}

.drag-preview-time {
  font-size: 0.75rem;
  opacity: 0.9;
}

.drag-over-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 2px dashed var(--color-accent);
  border-radius: var(--radius-md);
  background-color: rgba(255, 107, 53, 0.1);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.drag-invalid-drop {
  border-color: var(--color-error);
  background-color: rgba(229, 57, 53, 0.1);
}
`;
