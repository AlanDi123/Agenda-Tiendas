// Hook for managing event alarms and notifications
import { useEffect, useCallback, useRef } from 'react';
import type { Event, EventAlarm } from '../types';
import {
  initializeNotifications,
  scheduleAlarmNotification,
  cancelEventNotifications,
  rescheduleEventAlarms,
  scheduleAllUpcomingAlarms,
  cleanupOldNotifications,
} from '../services/notificationService';
import { AppLogger } from '../services/logger';

export function useEventAlarms(events: Event[]) {
  const initializedRef = useRef(false);
  const eventsRef = useRef<Event[]>(events);

  // Update events ref
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // Initialize notifications on mount
  useEffect(() => {
    if (!initializedRef.current) {
      initializeNotifications();
      initializedRef.current = true;
      AppLogger.info('Notifications initialized', {}, 'Alarms');
    }

    // Cleanup old notifications periodically
    const cleanupInterval = setInterval(() => {
      cleanupOldNotifications();
    }, 60 * 60 * 1000); // Every hour

    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);

  // Reschedule alarms when events change — retrasado 3s para no bloquear
  // la UI mientras la app termina de cargar la interfaz tras el login.
  useEffect(() => {
    if (!events || events.length === 0) return;

    const timer = setTimeout(() => {
      try {
        void scheduleAllUpcomingAlarms(events);
      } catch (error) {
        console.error('[EventAlarms] Error al programar alarmas en lote:', error);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [events]);

  // Schedule alarm for a specific event
  const scheduleAlarm = useCallback(async (event: Event, alarm: EventAlarm): Promise<number> => {
    const notificationId = await scheduleAlarmNotification(event, alarm);
    if (notificationId > 0) {
      AppLogger.info('Alarm scheduled', { eventId: event.id, alarmId: alarm.id, notificationId }, 'Alarms');
    }
    return notificationId;
  }, []);

  // Cancel all alarms for an event
  const cancelAlarms = useCallback(async (eventId: string): Promise<void> => {
    await cancelEventNotifications(eventId);
    AppLogger.info('Alarms canceled', { eventId }, 'Alarms');
  }, []);

  // Reschedule all alarms for an event (e.g., after edit)
  const rescheduleAlarms = useCallback(async (event: Event): Promise<void> => {
    await rescheduleEventAlarms(event);
    AppLogger.info('Alarms rescheduled', { eventId: event.id }, 'Alarms');
  }, []);

  // Toggle alarm on/off
  const toggleAlarm = useCallback(async (
    event: Event,
    alarm: EventAlarm,
    enabled: boolean
  ): Promise<void> => {
    if (enabled) {
      await scheduleAlarm(event, alarm);
    } else {
      // Find notification ID and cancel
      await cancelAlarms(event.id);
    }
  }, [scheduleAlarm, cancelAlarms]);

  return {
    scheduleAlarm,
    cancelAlarms,
    rescheduleAlarms,
    toggleAlarm,
  };
}
