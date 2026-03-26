import type { Environment, Event } from '../types';
import { apiFetch } from '../config/api';
import { getSetting, saveSetting } from './database';

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let queuedPayload: { environment: Environment; events: Event[]; queuedAt: string } | null = null;
const lastSuccessfulSyncAtByFamilyCode: Record<string, string> = {};

const DEBOUNCE_MS = 1200;
const SYNC_QUEUE_KEY = 'cloudSyncQueueByFamilyCode';
const RETRY_START_MS = 2000;
const RETRY_MAX_MS = 30000;
let currentRetryDelayMs = RETRY_START_MS;
const LAST_SYNC_AT_KEY_PREFIX = 'familyLastSyncAt:';

function lastSyncKey(familyCode: string): string {
  return `${LAST_SYNC_AT_KEY_PREFIX}${familyCode}`;
}

type PersistentSyncPayload = {
  queuedAt: string;
  environment: Environment;
  events: Event[];
};

async function loadPersistentQueue(): Promise<Record<string, PersistentSyncPayload>> {
  return (await getSetting<Record<string, PersistentSyncPayload>>(SYNC_QUEUE_KEY)) || {};
}

async function upsertPersistentPayload(familyCode: string, payload: PersistentSyncPayload): Promise<void> {
  const queue = await loadPersistentQueue();
  queue[familyCode] = payload;
  await saveSetting(SYNC_QUEUE_KEY, queue);
}

async function clearPersistentPayloadIfMatch(familyCode: string, queuedAt: string): Promise<void> {
  const queue = await loadPersistentQueue();
  if (queue[familyCode]?.queuedAt !== queuedAt) return; // En caso de payload nuevo, no borrarlo
  delete queue[familyCode];
  await saveSetting(SYNC_QUEUE_KEY, queue);
}

async function flush(token: string, familyCode?: string): Promise<void> {
  const targetFamilyCode =
    familyCode || queuedPayload?.environment.familyCode;
  if (inFlight || !targetFamilyCode) return;

  inFlight = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  try {
    const payload =
      queuedPayload?.environment.familyCode === targetFamilyCode
        ? queuedPayload
        : (await loadPersistentQueue())[targetFamilyCode];
    if (!payload) return;
    queuedPayload = payload;

    await apiFetch('/api/v1/families/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      json: {
        familyCode: targetFamilyCode,
        environment: payload.environment,
        events: payload.events,
      },
    });

    // Solo limpiamos si el payload en disco corresponde al que intentamos enviar
    await clearPersistentPayloadIfMatch(targetFamilyCode, payload.queuedAt);
    // Si llegó un payload nuevo durante el envío, no lo pisamos.
    if (queuedPayload?.queuedAt === payload.queuedAt) {
      queuedPayload = null;
    }

    currentRetryDelayMs = RETRY_START_MS;
    lastSuccessfulSyncAtByFamilyCode[targetFamilyCode] = new Date().toISOString();
    // Persistimos last sync para facilitar reconciliación en reinstalaciones/cambios futuros.
    void saveSetting(lastSyncKey(targetFamilyCode), lastSuccessfulSyncAtByFamilyCode[targetFamilyCode]);

    // Si mientras enviábamos se acumuló un payload nuevo, aseguramos que se procese.
    const remaining = (await loadPersistentQueue())[targetFamilyCode];
    if (remaining) {
      queuedPayload = remaining;
      setTimeout(() => {
        void flush(token, targetFamilyCode);
      }, 0);
    }
  } catch {
    // No perdemos el payload: se mantiene en disco y se reintentará con backoff.
    if (retryTimer) clearTimeout(retryTimer);
    const delay = currentRetryDelayMs;
    currentRetryDelayMs = Math.min(currentRetryDelayMs * 2, RETRY_MAX_MS);
    retryTimer = setTimeout(() => {
      void flush(token, targetFamilyCode);
    }, delay);
  } finally {
    inFlight = false;
  }
}

export function queueCloudFamilySync(environment: Environment, events: Event[]): void {
  const token = localStorage.getItem('authToken');
  if (!token || !environment?.familyCode) return;

  const familyCode = environment.familyCode;
  const lastSyncAt = lastSuccessfulSyncAtByFamilyCode[familyCode];
  const lastSyncMs = lastSyncAt ? new Date(lastSyncAt).getTime() : null;

  const eventsToSync =
    lastSyncMs === null
      ? events
      : events.filter((e) => {
          const updatedMs = e?.updatedAt ? new Date(e.updatedAt).getTime() : 0;
          return updatedMs > lastSyncMs;
        });

  const queuedAt = new Date().toISOString();
  queuedPayload = { environment, events: eventsToSync, queuedAt };
  // Persistimos la última versión por familia para reintentar si falla la red
  void upsertPersistentPayload(familyCode, { queuedAt, environment, events: eventsToSync });

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void flush(token, familyCode);
  }, DEBOUNCE_MS);
}

export async function loadFamilySnapshotByCode(familyCode: string): Promise<{
  environment: Environment;
  events: Event[];
}> {
  // Usamos paginación con `updatedAt` para no cargar todo el snapshot de golpe.
  // En este flujo (recuperación por código), partimos desde epoch para reconstruir todo.
  const since = '0';
  const limit = 200;

  let offset = 0;
  let environment: Environment | null = null;
  const allEvents: Event[] = [];

  while (true) {
    const response = await apiFetch(
      `/api/v1/families/updates/${encodeURIComponent(familyCode)}?since=${encodeURIComponent(since)}&offset=${offset}&limit=${limit}`,
      { method: 'GET', auth: true }
    );
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'No se pudo recuperar la familia');
    }

    const rawEnv = data.data.environment as any;
    if (!environment) {
      environment = {
        ...rawEnv,
        createdAt: new Date(rawEnv.createdAt),
        profiles: (rawEnv.profiles || []).map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
        })),
      };
    }

    const pageEvents: Event[] = (data.data.events || []).map((e: any) => ({
      ...e,
      startDate: new Date(e.startDate),
      endDate: new Date(e.endDate),
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
      deletedAt: e.deletedAt ? new Date(e.deletedAt) : undefined,
    }));

    allEvents.push(...pageEvents);

    if (!data.data.hasMore || pageEvents.length === 0) break;
    offset += pageEvents.length;
  }

  if (!environment) {
    throw new Error('No se pudo recuperar el ambiente de la familia');
  }

  return { environment, events: allEvents };
}

