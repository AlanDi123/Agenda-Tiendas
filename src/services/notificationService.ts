// Native Local Notifications Service
// Handles alarm notifications for events using Capacitor

import { LocalNotifications, type Action } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { Event, EventAlarm } from '../types';

export interface ScheduledNotification {
  id: number;
  eventId: string;
  alarmId: string;
  scheduledAt: Date;
}

// Initialize local notifications
export async function initializeNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Request permission
    const permission = await LocalNotifications.requestPermissions();
    console.log('Notification permission:', permission);

    // Configure notification channels (Android)
    if (Capacitor.getPlatform() === 'android') {
      await LocalNotifications.createChannel({
        id: 'event-alarms',
        name: 'Alarmas de Eventos',
        description: 'Notificaciones de alarmas para eventos de la agenda',
        importance: 4, // High importance
        visibility: 1, // Show on lock screen
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#FF6B35',
      });

      await LocalNotifications.createChannel({
        id: 'event-reminders',
        name: 'Recordatorios de Eventos',
        description: 'Recordatorios de eventos próximos',
        importance: 3, // Default importance
        visibility: 1,
        sound: 'default',
        vibration: false,
      });
    }
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
}

// Schedule a notification for an event alarm
export async function scheduleAlarmNotification(
  event: Event,
  alarm: EventAlarm,
  notificationId?: number
): Promise<number> {
  if (!Capacitor.isNativePlatform()) {
    console.log('Skipping notification scheduling (not native platform)');
    return -1;
  }

  try {
    const alarmTime = new Date(event.startDate);
    alarmTime.setMinutes(alarmTime.getMinutes() - alarm.minutesBefore);

    const now = new Date();
    
    // Don't schedule notifications in the past
    if (alarmTime <= now) {
      console.log('Alarm time is in the past, skipping:', alarmTime);
      return -1;
    }

    const deterministicId = notificationId ?? createDeterministicNotificationId(event.id, alarm.id);

    await LocalNotifications.schedule({
      notifications: [
        {
          title: '🔔 ' + event.title,
          body: getAlarmBody(alarm.minutesBefore, event),
          id: deterministicId,
          channelId: 'event-alarms',
          schedule: {
            at: alarmTime,
            allowWhileIdle: false,
          },
          actionTypeId: 'event-alarm-action',
          group: event.id,
          extra: {
            eventId: event.id,
            alarmId: alarm.id,
            minutesBefore: alarm.minutesBefore.toString(),
          },
        },
      ],
    });

    console.log('Scheduled alarm notification:', deterministicId, 'at', alarmTime);
    return deterministicId;
  } catch (error) {
    console.error('Error scheduling alarm notification:', error);
    return -1;
  }
}

// Deterministic notification id to avoid collisions when scheduling multiple alarms.
function createDeterministicNotificationId(eventId: string, alarmId: string): number {
  const input = `${eventId}:${alarmId}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  // Ensure positive integer within JS safe 32-bit range.
  return Math.abs(hash) % 2147483647;
}

// Get alarm notification body text
function getAlarmBody(minutesBefore: number, event: Event): string {
  const timeText = formatTimeBefore(minutesBefore);
  
  if (event.allDay) {
    return `Comienza ${timeText.toLowerCase()}`;
  }

  const startTime = new Date(event.startDate);
  const timeStr = startTime.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return `${timeText} • ${timeStr}${event.location ? ' • ' + event.location : ''}`;
}

// Format time before alarm
function formatTimeBefore(minutes: number): string {
  if (minutes < 60) {
    return `En ${minutes} minutos`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `En ${hours} hora${hours > 1 ? 's' : ''}`;
    }
    return `En ${hours}h ${mins}min`;
  } else {
    const days = Math.floor(minutes / 1440);
    return `En ${days} día${days > 1 ? 's' : ''}`;
  }
}

// Cancel a specific notification
export async function cancelNotification(notificationId: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: notificationId }],
    });
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
}

// Cancel all notifications for an event
export async function cancelEventNotifications(eventId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const pending = await LocalNotifications.getPending();
    
    const eventNotifications = pending.notifications.filter(
      n => n.extra?.eventId === eventId
    );

    if (eventNotifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: eventNotifications.map(n => ({ id: n.id })),
      });
    }
  } catch (error) {
    console.error('Error canceling event notifications:', error);
  }
}

// Cancel all notifications
export async function cancelAllNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map(n => ({ id: n.id })),
      });
    }
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
}

// Get pending notifications
export async function getPendingNotifications(): Promise<ScheduledNotification[]> {
  if (!Capacitor.isNativePlatform()) {
    return [];
  }

  try {
    const pending = await LocalNotifications.getPending();
    
    return pending.notifications
      .filter(n => n.extra?.eventId && n.extra?.alarmId)
      .map(n => ({
        id: n.id,
        eventId: n.extra.eventId,
        alarmId: n.extra.alarmId,
        scheduledAt: n.schedule?.at ? new Date(n.schedule.at) : new Date(),
      }));
  } catch (error) {
    console.error('Error getting pending notifications:', error);
    return [];
  }
}

// Setup notification actions (for interactive notifications)
export async function setupNotificationActions(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Define actions for event alarm notifications
    const dismissAction: Action = {
      id: 'dismiss',
      title: 'Descartar',
      requiresAuthentication: false,
      foreground: true,
      input: false,
    };

    const snoozeAction: Action = {
      id: 'snooze',
      title: 'Posponer 5min',
      requiresAuthentication: false,
      foreground: true,
      input: false,
    };

    const viewAction: Action = {
      id: 'view',
      title: 'Ver',
      requiresAuthentication: false,
      foreground: true,
      input: false,
    };

    // Register action types
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'event-alarm-action',
          actions: [viewAction, snoozeAction, dismissAction],
        },
      ],
    });

    // Listen for notification action events
    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      console.log('Notification action performed:', action);
      handleNotificationAction(action);
    });
  } catch (error) {
    console.error('Error setting up notification actions:', error);
  }
}

type NotificationActionPerformed = {
  actionId: string;
  notification: { extra?: { eventId?: string; alarmId?: string } };
};

// Handle notification actions
function handleNotificationAction(action: NotificationActionPerformed): void {
  const { actionId, notification } = action;
  const eventId = notification.extra?.eventId;
  const alarmId = notification.extra?.alarmId;

  switch (actionId) {
    case 'dismiss':
      // Just dismiss - notification is already cleared
      console.log('Alarm dismissed:', eventId, alarmId);
      break;
    case 'snooze':
      // Schedule snooze notification for 5 minutes later
      console.log('Alarm snoozed:', eventId, alarmId);
      // This would require additional logic to reschedule
      break;
    case 'view':
      // Navigate to event detail
      console.log('View event:', eventId);
      // This would trigger navigation in the app
      break;
  }
}

// Reschedule all alarms for an event
export async function rescheduleEventAlarms(event: Event): Promise<void> {
  // Cancel existing notifications
  await cancelEventNotifications(event.id);

  // Schedule new notifications for each alarm
  if (event.alarms) {
    for (const alarm of event.alarms) {
      if (!alarm.triggered) {
        await scheduleAlarmNotification(event, alarm);
      }
    }
  }
}

// Check and schedule alarms for all upcoming events
export async function scheduleAllUpcomingAlarms(events: Event[]): Promise<void> {
  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  for (const event of events) {
    const eventStart = new Date(event.startDate);
    
    // Only schedule alarms for events in the next 24 hours
    if (eventStart > now && eventStart <= next24Hours && event.alarms) {
      for (const alarm of event.alarms) {
        if (!alarm.triggered) {
          await scheduleAlarmNotification(event, alarm);
        }
      }
    }
  }
}

// Clean up old notifications
export async function cleanupOldNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const pending = await LocalNotifications.getPending();
    const now = new Date();

    const oldNotifications = pending.notifications.filter(
      n => n.schedule?.at && new Date(n.schedule.at) < now
    );

    if (oldNotifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: oldNotifications.map(n => ({ id: n.id })),
      });
      console.log('Cleaned up', oldNotifications.length, 'old notifications');
    }
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
  }
}
