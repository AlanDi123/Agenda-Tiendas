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
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<ExpandedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());

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
    const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    
    // Expandir un poco más para cubrir semanas completas
    const expanded = expandRecurringEvents(events, startOfMonth, endOfMonth);
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

    await saveEvent(event);
    setEvents(prev => [...prev, event]);
    return event;
  }, []);

  const updateEvent = useCallback(async (
    event: Event,
    scope: 'single' | 'future' | 'all'
  ) => {
    const updatedEvent = {
      ...event,
      updatedAt: new Date(),
    };

    if (scope === 'all' || !event.rrule) {
      // Actualizar toda la serie
      await saveEvent(updatedEvent);
      setEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
    } else if (scope === 'future') {
      // Para eventos futuros, necesitamos crear un nuevo evento recurrente
      await saveEvent(updatedEvent);
      setEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
    } else {
      // Solo este evento - crear una excepción
      await saveEvent(updatedEvent);
      setEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
    }
  }, []);

  const deleteEvent = useCallback(async (
    eventId: string,
    scope: 'single' | 'future' | 'all'
  ) => {
    if (scope === 'all') {
      await deleteEventFromDB(eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } else {
      // Para 'single' o 'future', en una implementación completa
      // manejaríamos las excepciones de recurrencia
      await deleteEventFromDB(eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
    }
  }, []);

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
