/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { agendaEventsQueryKey } from '../lib/queryClient';

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
  const queryClient = useQueryClient();
  const { environment, isAuthenticated } = useAuth();
  const { addToast } = useToastActions();

  const {
    data: events = [],
    isPending,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: agendaEventsQueryKey,
    queryFn: getAllEvents,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      queryClient.removeQueries({ queryKey: agendaEventsQueryKey });
    }
  }, [isAuthenticated, queryClient]);

  const [viewDate, setViewDate] = useState(new Date());
  const expandedEvents = useMemo<ExpandedEvent[]>(() => {
    const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    start.setDate(start.getDate() - 42);
    const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    end.setDate(end.getDate() + 42);

    return expandRecurringEvents(
      events.filter((e) => !e.deletedAt),
      start,
      end
    );
  }, [events, viewDate]);

  const activeEventsForAlarms = events.filter((e) => !e.deletedAt);
  const { scheduleAlarm, cancelAlarms, rescheduleAlarms } = useEventAlarms(activeEventsForAlarms);

  const notifyFamily = useCallback(
    (event: Event, action: 'create' | 'update' | 'delete') => {
      const labels = {
        create: `📅 Nuevo evento: "${event.title}"`,
        update: `✏️ Evento actualizado: "${event.title}"`,
        delete: `🗑️ Evento eliminado: "${event.title}"`,
      };
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
              .map((p) => p.email?.trim())
              .filter((e): e is string => !!e),
          },
        }).catch(() => {});
      }
    },
    [addToast, environment]
  );

  const loadEvents = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => {
    const handler = () => {
      void queryClient.invalidateQueries({ queryKey: agendaEventsQueryKey });
    };
    window.addEventListener('agenda-reload-events', handler);
    return () => window.removeEventListener('agenda-reload-events', handler);
  }, [queryClient]);

  const isLoading = isPending || (isFetching && events.length === 0);

  const createEvent = useCallback(
    async (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> => {
      const timeError = validateEventTimeRange(
        new Date(eventData.startDate),
        new Date(eventData.endDate),
        !!eventData.allDay
      );
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
        queryClient.setQueryData<Event[]>(agendaEventsQueryKey, (prev = []) => [...prev, event]);

        if (event.alarms && event.alarms.length > 0) {
          for (const alarm of event.alarms) {
            await scheduleAlarm(event, alarm);
          }
        }

        addToast(`Evento "${event.title}" creado`, 'success');
        AppLogger.logUserAction('create_event', { eventId: event.id, title: event.title });

        return event;
      } catch (error) {
        AppLogger.error('Error creating event', error, 'EventsContext');
        addToast('Error al crear evento', 'error');
        throw error;
      }
    },
    [addToast, scheduleAlarm, queryClient]
  );

  const updateEvent = useCallback(
    async (event: Event, scope: 'single' | 'future' | 'all') => {
      try {
        const timeError = validateEventTimeRange(
          new Date(event.startDate),
          new Date(event.endDate),
          !!event.allDay
        );
        if (timeError) {
          throw new Error(timeError);
        }
        const prev = events.find((e) => e.id === event.id);
        const nextVersion = (prev?.version ?? event.version ?? 0) + 1;
        const updatedEvent = {
          ...event,
          updatedAt: new Date(),
          version: nextVersion,
        };

        await saveEvent(updatedEvent);
        queryClient.setQueryData<Event[]>(agendaEventsQueryKey, (list = []) =>
          list.map((e) => (e.id === event.id ? updatedEvent : e))
        );

        await rescheduleAlarms(updatedEvent);

        addToast(`Evento "${event.title}" actualizado`, 'success');
        AppLogger.logUserAction('update_event', { eventId: event.id, scope });

        notifyFamily(updatedEvent, 'update');
      } catch (error) {
        AppLogger.error('Error updating event', error, 'EventsContext');
        addToast('Error al actualizar evento', 'error');
        throw error;
      }
    },
    [addToast, rescheduleAlarms, notifyFamily, events, queryClient]
  );

  const deleteEventFn = useCallback(
    async (eventId: string, scope: 'single' | 'future' | 'all') => {
      try {
        const event = events.find((e) => e.id === eventId);
        const now = new Date();
        const deletedEvent: Event | undefined = event
          ? { ...event, deletedAt: now, updatedAt: now, version: (event.version ?? 0) + 1 }
          : undefined;

        if (event) {
          await cancelAlarms(eventId);
        }

        await deleteEventFromDB(eventId);
        queryClient.setQueryData<Event[]>(agendaEventsQueryKey, (list = []) =>
          list.map((e) => (e.id === eventId ? deletedEvent ?? e : e))
        );

        if (event) {
          notifyFamily(deletedEvent as Event, 'delete');
          AppLogger.logUserAction('delete_event', { eventId, scope });
        }
      } catch (error) {
        AppLogger.error('Error deleting event', error, 'EventsContext');
        addToast('Error al eliminar evento', 'error');
        throw error;
      }
    },
    [events, addToast, cancelAlarms, notifyFamily, queryClient]
  );

  const getEventById = useCallback(async (id: string): Promise<Event | undefined> => {
    return getEvent(id);
  }, []);

  return (
    <EventsContext.Provider
      value={{
        events,
        expandedEvents,
        isLoading,
        loadEvents,
        createEvent,
        updateEvent,
        deleteEvent: deleteEventFn,
        getEventById,
        viewDate,
        setViewDate,
        notifyFamily,
      }}
    >
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
