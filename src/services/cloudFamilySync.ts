import type { Environment, Event } from '../types';
import { apiFetch } from '../config/api';

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let queuedPayload: { environment: Environment; events: Event[] } | null = null;

const DEBOUNCE_MS = 1200;

async function flush(token: string): Promise<void> {
  if (inFlight || !queuedPayload) return;
  const payload = queuedPayload;
  queuedPayload = null;
  inFlight = true;
  try {
    await apiFetch('/api/v1/families/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      json: {
        familyCode: payload.environment.familyCode,
        environment: payload.environment,
        events: payload.events,
      },
    });
  } finally {
    inFlight = false;
    if (queuedPayload) {
      await flush(token);
    }
  }
}

export function queueCloudFamilySync(environment: Environment, events: Event[]): void {
  const token = localStorage.getItem('authToken');
  if (!token || !environment?.familyCode) return;

  queuedPayload = { environment, events };
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void flush(token);
  }, DEBOUNCE_MS);
}

export async function loadFamilySnapshotByCode(familyCode: string): Promise<{
  environment: Environment;
  events: Event[];
}> {
  const response = await apiFetch(`/api/v1/families/by-code/${encodeURIComponent(familyCode)}`, {
    method: 'GET',
    auth: true,
  });
  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || 'No se pudo recuperar la familia');
  }

  const rawEnv = data.data.environment as any;
  const normalizedEnv: Environment = {
    ...rawEnv,
    createdAt: new Date(rawEnv.createdAt),
    profiles: (rawEnv.profiles || []).map((p: any) => ({
      ...p,
      createdAt: new Date(p.createdAt),
    })),
  };

  const normalizedEvents: Event[] = (data.data.events || []).map((e: any) => ({
    ...e,
    startDate: new Date(e.startDate),
    endDate: new Date(e.endDate),
    createdAt: new Date(e.createdAt),
    updatedAt: new Date(e.updatedAt),
  }));

  return {
    environment: normalizedEnv,
    events: normalizedEvents,
  };
}

