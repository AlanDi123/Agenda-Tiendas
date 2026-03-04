// Hook for drag and drop event rescheduling
import { useState, useCallback, useRef } from 'react';

interface DragDropOptions {
  onDrop?: (date: Date, eventId: string) => void;
  onDragStart?: (eventId: string) => void;
  onDragEnd?: () => void;
  enabled?: boolean;
}

interface DragDropResult {
  isDragging: boolean;
  draggedEventId: string | null;
  dragOverDate: Date | null;
  handleDragStart: (e: React.DragEvent, eventId: string) => void;
  handleDragEnd: () => void;
  handleDragOver: (e: React.DragEvent, date: Date) => void;
  handleDrop: (e: React.DragEvent, date: Date) => void;
}

export function useDragDrop(options: DragDropOptions = {}): DragDropResult {
  const {
    onDrop,
    onDragStart,
    onDragEnd,
    enabled = true,
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);
  const dragOverDateRef = useRef<Date | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, eventId: string) => {
    if (!enabled) {
      e.preventDefault();
      return;
    }

    setIsDragging(true);
    setDraggedEventId(eventId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', eventId);
    
    // Set drag image (optional)
    const dragImage = document.createElement('div');
    dragImage.className = 'event-drag-image';
    dragImage.textContent = 'Moving event...';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);

    onDragStart?.(eventId);
  }, [enabled, onDragStart]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedEventId(null);
    setDragOverDate(null);
    dragOverDateRef.current = null;
    onDragEnd?.();
  }, [onDragEnd]);

  const handleDragOver = useCallback((e: React.DragEvent, date: Date) => {
    if (!enabled) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Only update if date changed to avoid re-renders
    if (dragOverDateRef.current?.getTime() !== date.getTime()) {
      dragOverDateRef.current = date;
      setDragOverDate(date);
    }
  }, [enabled]);

  const handleDrop = useCallback((e: React.DragEvent, date: Date) => {
    if (!enabled) return;
    
    e.preventDefault();
    const eventId = e.dataTransfer.getData('text/plain');
    
    if (eventId) {
      onDrop?.(date, eventId);
    }
    
    handleDragEnd();
  }, [enabled, onDrop, handleDragEnd]);

  return {
    isDragging,
    draggedEventId,
    dragOverDate,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  };
}
