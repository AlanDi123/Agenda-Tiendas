import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Environment, Event } from '../types';
import type { User, EmailVerificationToken, PasswordResetToken, AuthSession } from '../types/auth';
import type { Payment, PaymentSession, Subscription, DiscountCode, UserDiscountUsage } from '../types/payment';

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
  // Auth stores
  users: {
    key: string; // email as key
    value: User;
  };
  sessions: {
    key: string; // email as key
    value: AuthSession;
  };
  emailVerificationTokens: {
    key: string; // email as key
    value: EmailVerificationToken;
  };
  passwordResetTokens: {
    key: string; // email as key
    value: PasswordResetToken;
  };
  // Payment & Subscription stores
  payments: {
    key: string;
    value: Payment;
    indexes: { 'by-user': string; 'by-transaction': string };
  };
  paymentSessions: {
    key: string;
    value: PaymentSession;
    indexes: { 'by-user': string; 'by-status': string };
  };
  subscriptions: {
    key: string;
    value: Subscription;
    indexes: { 'by-user': string; 'by-status': string };
  };
  discountCodes: {
    key: string; // code uppercase
    value: DiscountCode;
  };
  userDiscountUsage: {
    key: string;
    value: UserDiscountUsage;
    indexes: { 'by-user': string; 'by-code': string };
  };
}

const DB_NAME = 'agenda-tiendas-db';
const DB_VERSION = 5;

let dbInstance: IDBPDatabase<AgendaDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<AgendaDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AgendaDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
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

      // Auth stores (v3)
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'email' });
      }

      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'email' });
      }

      if (!db.objectStoreNames.contains('emailVerificationTokens')) {
        db.createObjectStore('emailVerificationTokens', { keyPath: 'email' });
      }

      if (!db.objectStoreNames.contains('passwordResetTokens')) {
        db.createObjectStore('passwordResetTokens', { keyPath: 'email' });
      }

      // Payment stores (v3)
      if (!db.objectStoreNames.contains('payments')) {
        const paymentStore = db.createObjectStore('payments', { keyPath: 'id' });
        paymentStore.createIndex('by-user', 'userId');
        paymentStore.createIndex('by-transaction', 'transactionId');
      }

      if (!db.objectStoreNames.contains('paymentSessions')) {
        const sessionStore = db.createObjectStore('paymentSessions', { keyPath: 'id' });
        sessionStore.createIndex('by-user', 'userId');
        sessionStore.createIndex('by-status', 'status');
      }

      // Subscription stores (v4)
      if (!db.objectStoreNames.contains('subscriptions')) {
        const subStore = db.createObjectStore('subscriptions', { keyPath: 'id' });
        subStore.createIndex('by-user', 'userId');
        subStore.createIndex('by-status', 'status');
      }

      if (!db.objectStoreNames.contains('discountCodes')) {
        db.createObjectStore('discountCodes', { keyPath: 'code' });
      }

      if (!db.objectStoreNames.contains('userDiscountUsage')) {
        const usageStore = db.createObjectStore('userDiscountUsage', { keyPath: 'id' });
        usageStore.createIndex('by-user', 'userId');
        usageStore.createIndex('by-code', 'discountCode');
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
