import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
import { apiFetch } from '../config/api';
import { useAuth } from './AuthContext';
import { validateEventTimeRange } from '../domain/eventValidation';
import { useToastActions } from './ToastContext';

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
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const expandedEvents = useMemo<ExpandedEvent[]>(() => {
    // Expandir 6 semanas antes y después del mes visible para cubrir week/day view
    const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    start.setDate(start.getDate() - 42);
    const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    end.setDate(end.getDate() + 42);

    return expandRecurringEvents(
      events.filter(e => !e.deletedAt),
      start,
      end
    );
  }, [events, viewDate]);

  const { environment } = useAuth();
  const { addToast } = useToastActions();

  // Initialize alarm management
  // Los "tombstones" (events con deletedAt) no deben programar alarmas ni expandirse para la grilla.
  const activeEventsForAlarms = events.filter(e => !e.deletedAt);
  const { scheduleAlarm, cancelAlarms, rescheduleAlarms } = useEventAlarms(activeEventsForAlarms);

  // Notificación a la familia (simulada + backend push)
  const notifyFamily = useCallback((event: Event, action: 'create' | 'update' | 'delete') => {
    const labels = {
      create: `📅 Nuevo evento: "${event.title}"`,
      update: `✏️ Evento actualizado: "${event.title}"`,
      delete: `🗑️ Evento eliminado: "${event.title}"`,
    };
    // Toast local para el usuario actual
    addToast(labels[action], action === 'delete' ? 'warning' : 'info');

    const token = localStorage.getItem('authToken');
    if (token) {
      apiFetch('/api/v1/notifications/family', {
        method: 'POST',
        auth: true,
        json: {
          action,
          eventTitle: event.title,
          eventId: event.id,
          startDate: event.startDate,
          familyMemberEmails: (environment?.profiles || [])
            .map(p => p.email?.trim())
            .filter((e): e is string => !!e),
        },
      }).catch(() => {}); // Ignorar errores — no bloquear la UX
    }
  }, [addToast, environment]);

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

  useEffect(() => {
    const handler = () => {
      void loadEvents();
    };
    window.addEventListener('agenda-reload-events', handler);
    return () => window.removeEventListener('agenda-reload-events', handler);
  }, [loadEvents]);

  // expandedEvents ahora es derivado (useMemo), sin estado adicional.

  const createEvent = useCallback(async (
    eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Event> => {
    const timeError = validateEventTimeRange(new Date(eventData.startDate), new Date(eventData.endDate), !!eventData.allDay);
    if (timeError) {
      throw new Error(timeError);
    }

    const event: Event = {
      ...eventData,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
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
      const timeError = validateEventTimeRange(new Date(event.startDate), new Date(event.endDate), !!event.allDay);
      if (timeError) {
        throw new Error(timeError);
      }
      const prev = events.find(e => e.id === event.id);
      const nextVersion = (prev?.version ?? event.version ?? 0) + 1;
      const updatedEvent = {
        ...event,
        updatedAt: new Date(),
        version: nextVersion,
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
  }, [addToast, rescheduleAlarms, notifyFamily, events]);

  const deleteEvent = useCallback(async (
    eventId: string,
    scope: 'single' | 'future' | 'all'
  ) => {
    try {
      const event = events.find(e => e.id === eventId);
      const now = new Date();
      const deletedEvent: Event | undefined = event
        ? { ...event, deletedAt: now, updatedAt: now, version: (event.version ?? 0) + 1 }
        : undefined;

      // Cancel alarms first
      if (event) {
        await cancelAlarms(eventId);
      }

      await deleteEventFromDB(eventId);
      // No eliminamos del estado: necesitamos mantener el tombstone para que el sync lo propague.
      setEvents(prev => prev.map(e => (e.id === eventId ? deletedEvent ?? e : e)));
      
      if (event) {
        notifyFamily(deletedEvent as Event, 'delete');
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
