import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Environment, Event } from '../types';

interface AgendaDB extends DBSchema {
  environments: {
    key: string;
    value: Environment;
  };
  events: {
    key: string;
    value: Event;
    indexes: { 'by-date': Date[]; 'by-profile': string[] };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
  settingsMigration: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'agenda-tiendas-db';
const DB_VERSION = 2;

let dbInstance: IDBPDatabase<AgendaDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<AgendaDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AgendaDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Store environments
      if (!db.objectStoreNames.contains('environments')) {
        db.createObjectStore('environments', { keyPath: 'id' });
      }

      // Store events
      if (!db.objectStoreNames.contains('events')) {
        const eventStore = db.createObjectStore('events', { keyPath: 'id' });
        eventStore.createIndex('by-date', 'startDate');
        eventStore.createIndex('by-profile', 'assignedProfileIds', { multiEntry: true });
      }

      // Store settings
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      
      // Migration from v1 to v2: Add userSessions to settings
      if (oldVersion < 2) {
        // UserSessions will be initialized on first use
      }
    },
  });

  return dbInstance;
}

// Environment operations
export async function saveEnvironment(env: Environment): Promise<void> {
  const db = await getDB();
  await db.put('environments', env);
}

export async function getEnvironment(id: string): Promise<Environment | undefined> {
  const db = await getDB();
  return db.get('environments', id);
}

export async function getAllEnvironments(): Promise<Environment[]> {
  const db = await getDB();
  return db.getAll('environments');
}

export async function deleteEnvironment(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('environments', id);
}

// Event operations
export async function saveEvent(event: Event): Promise<void> {
  const db = await getDB();
  await db.put('events', event);
}

export async function getEvent(id: string): Promise<Event | undefined> {
  const db = await getDB();
  return db.get('events', id);
}

export async function getAllEvents(): Promise<Event[]> {
  const db = await getDB();
  return db.getAll('events');
}

export async function getEventsByDateRange(start: Date, end: Date): Promise<Event[]> {
  const db = await getDB();
  const allEvents = await db.getAll('events');
  return allEvents.filter(event => {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);
    return eventStart <= end && eventEnd >= start;
  });
}

export async function deleteEvent(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('events', id);
}

// Settings operations
export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, value });
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const setting = await db.get('settings', key);
  return setting?.value as T;
}

export async function getDarkMode(): Promise<boolean> {
  const saved = await getSetting<boolean>('darkMode');
  return saved ?? false;
}

export async function setDarkMode(darkMode: boolean): Promise<void> {
  await saveSetting('darkMode', darkMode);
}

// User sessions (for auto-login)
export async function saveUserSession(email: string, environmentId: string): Promise<void> {
  const sessions = await getSetting<Record<string, string>>('userSessions') || {};
  sessions[email.toLowerCase()] = environmentId;
  await saveSetting('userSessions', sessions);
}

export async function getUserSession(email: string): Promise<string | undefined> {
  const sessions = await getSetting<Record<string, string>>('userSessions') || {};
  return sessions[email.toLowerCase()];
}

export async function clearUserSession(email: string): Promise<void> {
  const sessions = await getSetting<Record<string, string>>('userSessions') || {};
  delete sessions[email.toLowerCase()];
  await saveSetting('userSessions', sessions);
}

export async function getAllUserSessions(): Promise<Record<string, string>> {
  return await getSetting<Record<string, string>>('userSessions') || {};
}
