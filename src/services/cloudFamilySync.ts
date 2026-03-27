import type { Environment, Event } from '../types';
import { apiFetch } from '../config/api';
import { getSetting, saveSetting } from './database';

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let queuedPayload: { environment: Environment; events: Event[]; queuedAt: string } | null = null;
const lastSuccessfulSyncAtByFamilyCode: Record<string, string> = {};

/** 3-second debounce para agrupar ediciones rápidas en un solo batch */
const DEBOUNCE_MS = 3000;
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
  checksum?: number;
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
  if (queue[familyCode]?.queuedAt !== queuedAt) return;
  delete queue[familyCode];
  await saveSetting(SYNC_QUEUE_KEY, queue);
}

/** Checksum simple: suma de longitudes de IDs de eventos activos */
function computeChecksum(events: Event[]): number {
  return events
    .filter((e) => !(e as any).deletedAt)
    .reduce((acc, e) => acc + (e.id?.length ?? 0), 0);
}

// AbortController para cancelar sync en vuelo si el usuario se desconecta
let flushAbortController: AbortController | null = null;

async function flush(token: string, familyCode?: string): Promise<void> {
  const targetFamilyCode = familyCode || queuedPayload?.environment.familyCode;
  if (inFlight || !targetFamilyCode) return;

  inFlight = true;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }

  flushAbortController = new AbortController();
  const { signal } = flushAbortController;

  try {
    const payload =
      queuedPayload?.environment.familyCode === targetFamilyCode
        ? queuedPayload
        : (await loadPersistentQueue())[targetFamilyCode];
    if (!payload) return;
    queuedPayload = payload;

    const checksum = computeChecksum(payload.events);

    const response = await apiFetch('/api/v1/families/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      json: {
        familyCode: targetFamilyCode,
        environment: payload.environment,
        events: payload.events,
        checksum,
      },
      signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || `HTTP ${response.status}`);
    }

    await clearPersistentPayloadIfMatch(targetFamilyCode, payload.queuedAt);
    if (queuedPayload?.queuedAt === payload.queuedAt) queuedPayload = null;

    currentRetryDelayMs = RETRY_START_MS;
    lastSuccessfulSyncAtByFamilyCode[targetFamilyCode] = new Date().toISOString();
    void saveSetting(lastSyncKey(targetFamilyCode), lastSuccessfulSyncAtByFamilyCode[targetFamilyCode]);

    const remaining = (await loadPersistentQueue())[targetFamilyCode];
    if (remaining) {
      queuedPayload = remaining;
      setTimeout(() => void flush(token, targetFamilyCode), 0);
    }
  } catch (err) {
    if ((err as any)?.name === 'AbortError') return; // usuario canceló

    if (retryTimer) clearTimeout(retryTimer);
    const delay = currentRetryDelayMs;
    currentRetryDelayMs = Math.min(currentRetryDelayMs * 2, RETRY_MAX_MS);
    retryTimer = setTimeout(() => void flush(token, targetFamilyCode), delay);
  } finally {
    inFlight = false;
    flushAbortController = null;
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
        const updatedMs = e?.updatedAt ? new Date(e.updatedAt as any).getTime() : 0;
        return updatedMs > lastSyncMs;
      });

  const queuedAt = new Date().toISOString();
  queuedPayload = { environment, events: eventsToSync, queuedAt };
  void upsertPersistentPayload(familyCode, { queuedAt, environment, events: eventsToSync });

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void flush(token, familyCode), DEBOUNCE_MS);
}

/** Cancela cualquier sync en vuelo (usar al desmontar/desconectar) */
export function cancelPendingSync(): void {
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  flushAbortController?.abort();
}

/** Purga toda la cola local al desconectarse de una familia */
export async function purgeFamilyData(familyCode: string): Promise<void> {
  cancelPendingSync();
  const queue = await loadPersistentQueue();
  delete queue[familyCode];
  await saveSetting(SYNC_QUEUE_KEY, queue);
  delete lastSuccessfulSyncAtByFamilyCode[familyCode];

  // Borrar last-sync timestamp
  const storage = typeof localStorage !== 'undefined' ? localStorage : null;
  if (storage) {
    storage.removeItem(lastSyncKey(familyCode));
  }
}

export async function loadFamilySnapshotByCode(familyCode: string): Promise<{
  environment: Environment;
  events: Event[];
}> {
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

  if (!environment) throw new Error('No se pudo recuperar el ambiente de la familia');

  // Verificar checksum del lado cliente
  const serverChecksum: number | undefined = undefined; // El servidor puede devolver esto en el futuro
  if (serverChecksum !== undefined) {
    const localChecksum = computeChecksum(allEvents);
    if (localChecksum !== serverChecksum) {
      console.warn('[Sync] Checksum mismatch, forzando full sync');
    }
  }

  return { environment, events: allEvents };
}
