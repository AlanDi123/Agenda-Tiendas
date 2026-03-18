import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Event, ExpandedEvent } from '../types';
import {
  saveEvent,
  getAllEvents,
  getEvent,
  deleteEvent as deleteEventFromDB,
} from '../services/database';
import { expandRecurringEvents } from '../services/recurrence';
import { generateId } from '../utils/helpers';
import { AppLogger } from '../services/logger';
import { useEventAlarms } from '../hooks/useEventAlarms';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface EventsContextType {
  events: Event[];
  expandedEvents: ExpandedEvent[];
  isLoading: boolean;
  loadEvents: () => Promise<void>;
  createEvent: (event: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Event>;
  updateEvent: (event: Event, scope: 'single' | 'future' | 'all') => Promise<void>;
  deleteEvent: (eventId: string, scope: 'single' | 'future' | 'all') => Promise<void>;
  getEventById: (id: string) => Promise<Event | undefined>;
  setViewDate: (date: Date) => void;
  viewDate: Date;
  notifyFamily: (event: Event, action: 'create' | 'update' | 'delete') => void;
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
  toasts: Toast[];
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<ExpandedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Initialize alarm management
  const { scheduleAlarm, cancelAlarms, rescheduleAlarms } = useEventAlarms(events);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove toast after 5 seconds (silent save pattern)
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Notificación a la familia (simulada)
  const notifyFamily = useCallback((event: Event, action: 'create' | 'update' | 'delete') => {
    const messages = {
      create: `📅 Nuevo evento: "${event.title}"`,
      update: `✏️ Evento actualizado: "${event.title}"`,
      delete: `🗑️ Evento eliminado: "${event.title}"`,
    };
    addToast(messages[action], action === 'delete' ? 'warning' : 'info');
  }, [addToast]);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const allEvents = await getAllEvents();
      setEvents(allEvents);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Expandir eventos cuando cambie la vista o los eventos
  useEffect(() => {
    // Expandir 6 semanas antes y después del mes visible para cubrir week/day view
    const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    start.setDate(start.getDate() - 42);
    const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    end.setDate(end.getDate() + 42);
    const expanded = expandRecurringEvents(events, start, end);
    setExpandedEvents(expanded);
  }, [events, viewDate]);

  const createEvent = useCallback(async (
    eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Event> => {
    const event: Event = {
      ...eventData,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await saveEvent(event);
      setEvents(prev => [...prev, event]);
      
      // Schedule alarms if present
      if (event.alarms && event.alarms.length > 0) {
        for (const alarm of event.alarms) {
          await scheduleAlarm(event, alarm);
        }
      }
      
      // Silent save with toast notification
      addToast(`Evento "${event.title}" creado`, 'success');
      AppLogger.logUserAction('create_event', { eventId: event.id, title: event.title });
      
      return event;
    } catch (error) {
      AppLogger.error('Error creating event', error, 'EventsContext');
      addToast('Error al crear evento', 'error');
      throw error;
    }
  }, [addToast, scheduleAlarm]);

  const updateEvent = useCallback(async (
    event: Event,
    scope: 'single' | 'future' | 'all'
  ) => {
    try {
      const updatedEvent = {
        ...event,
        updatedAt: new Date(),
      };

      await saveEvent(updatedEvent);
      setEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
      
      // Reschedule alarms for updated event
      await rescheduleAlarms(updatedEvent);
      
      // Silent save with toast
      addToast(`Evento "${event.title}" actualizado`, 'success');
      AppLogger.logUserAction('update_event', { eventId: event.id, scope });
      
      notifyFamily(updatedEvent, 'update');
    } catch (error) {
      AppLogger.error('Error updating event', error, 'EventsContext');
      addToast('Error al actualizar evento', 'error');
      throw error;
    }
  }, [addToast, rescheduleAlarms, notifyFamily]);

  const deleteEvent = useCallback(async (
    eventId: string,
    scope: 'single' | 'future' | 'all'
  ) => {
    try {
      const event = events.find(e => e.id === eventId);

      // Cancel alarms first
      if (event) {
        await cancelAlarms(eventId);
      }

      await deleteEventFromDB(eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
      
      if (event) {
        notifyFamily(event, 'delete');
        AppLogger.logUserAction('delete_event', { eventId, scope });
      }
    } catch (error) {
      AppLogger.error('Error deleting event', error, 'EventsContext');
      addToast('Error al eliminar evento', 'error');
      throw error;
    }
  }, [events, addToast, cancelAlarms, notifyFamily]);

  const getEventById = useCallback(async (id: string): Promise<Event | undefined> => {
    return getEvent(id);
  }, []);

  return (
    <EventsContext.Provider value={{
      events,
      expandedEvents,
      isLoading,
      loadEvents,
      createEvent,
      updateEvent,
      deleteEvent,
      getEventById,
      viewDate,
      setViewDate,
      notifyFamily,
      addToast,
      removeToast,
      toasts,
    }}>
      {children}
    </EventsContext.Provider>
  );
}

export function useEvents() {
  const context = useContext(EventsContext);
  if (context === undefined) {
    throw new Error('useEvents must be used within an EventsProvider');
  }
  return context;
}
