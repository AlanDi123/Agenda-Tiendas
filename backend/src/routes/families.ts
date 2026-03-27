import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { getFamilySnapshotByCode, saveFamilySnapshot } from '../services/familySnapshotService';
import { createError } from '../middleware/errorHandler';
import { notifyUser } from '../services/pushService';

const FREE_EVENT_LIMIT = 50;

const router = Router();

function sanitizeTitle(str: string): string {
  return str.replace(/[<>&"']/g, '').slice(0, 80);
}

const syncSchema = z.object({
  familyCode: z.string().min(4).max(16),
  environment: z.any(),
  events: z.array(z.any()),
});

function getEventUpdatedAtMs(event: any): number {
  const v = event?.updatedAt;
  if (!v) return 0;
  const ms = new Date(v as any).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function getEventVersion(event: any): number | null {
  const v = event?.version;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function shouldReplaceEvent(prev: any, incoming: any): boolean {
  const prevV = getEventVersion(prev);
  const incomingV = getEventVersion(incoming);

  // Si hay version en ambos, ganan las versiones mayores.
  if (typeof prevV === 'number' && typeof incomingV === 'number') {
    if (incomingV !== prevV) return incomingV > prevV;
  }

  // Fallback: updatedAt
  return getEventUpdatedAtMs(incoming) >= getEventUpdatedAtMs(prev);
}

function mergeEventsByIdWithUpdatedAt(existing: any[], incoming: any[]): any[] {
  const map = new Map<string, any>();
  for (const ev of existing || []) {
    const id = ev?.id;
    if (typeof id === 'string') map.set(id, ev);
  }

  for (const ev of incoming || []) {
    const id = ev?.id;
    if (typeof id !== 'string') continue;
    const prev = map.get(id);

    // Tombstone: si llega `deletedAt`, eliminamos del snapshot cuando el tombstone es más reciente.
    if (ev?.deletedAt) {
      if (!prev) continue;
      if (shouldReplaceEvent(prev, ev)) {
        map.delete(id);
      }
      continue;
    }

    if (!prev) {
      map.set(id, ev);
      continue;
    }
    if (shouldReplaceEvent(prev, ev)) {
      map.set(id, ev);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const ida = String(a?.id ?? '');
    const idb = String(b?.id ?? '');
    return ida.localeCompare(idb);
  });
}

router.post('/sync', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user?.id || !user.email) {
      throw createError('Usuario no autenticado', 401, 'UNAUTHORIZED');
    }

    const parsed = syncSchema.parse(req.body);

    // Delta sync: mergeamos eventos por `id` usando `updatedAt` como ganador.
    let existingEvents: any[] = [];
    try {
      const snapshot = await getFamilySnapshotByCode(parsed.familyCode);
      existingEvents = (snapshot as any)?.events || [];
    } catch (err: any) {
      // Si no existe snapshot aún, inicializamos con los eventos entrantes.
      // (Se mantiene silencioso porque es un flujo normal en primera instalación.)
      existingEvents = [];
    }

    const mergedEvents = mergeEventsByIdWithUpdatedAt(existingEvents, parsed.events);

    // Plan enforcement: FREE users cannot exceed FREE_EVENT_LIMIT active events
    const isFree = !user.planType || user.planType === 'FREE';
    const activeEvents = mergedEvents.filter((e: any) => !e?.deletedAt);
    if (isFree && activeEvents.length > FREE_EVENT_LIMIT) {
      throw createError(
        `El plan gratuito permite hasta ${FREE_EVENT_LIMIT} eventos. Actualizá a Premium para continuar.`,
        403,
        'EVENT_LIMIT_REACHED'
      );
    }

    await saveFamilySnapshot({
      ownerId: user.id,
      ownerEmail: user.email,
      familyCode: parsed.familyCode,
      payload: {
        environment: parsed.environment,
        events: mergedEvents,
        syncedAt: new Date().toISOString(),
      },
    });

    // Detectar eventos eliminados (tombstones) y notificar a los demás miembros
    const deletedEventIds = (parsed.events || [])
      .filter((e: any) => e?.deletedAt)
      .map((e: any) => e.id as string);

    if (deletedEventIds.length > 0) {
      const profiles: any[] = (parsed.environment as any)?.profiles || [];
      const otherUserIds = profiles
        .filter((p: any) => p.userId && p.userId !== user.id)
        .map((p: any) => p.userId as string);

      const deletedTitles = deletedEventIds
        .map((id: string) => {
          const ev = (parsed.events as any[]).find((e: any) => e.id === id);
          return sanitizeTitle(ev?.title || 'Evento desconocido');
        })
        .join(', ');

      const actorName = profiles.find((p: any) => p.userId === user.id)?.name || user.email;

      for (const memberId of otherUserIds) {
        void notifyUser({
          userId: memberId,
          environmentId: (parsed.environment as any)?.id,
          type: 'event_deleted',
          title: '🗑️ Evento eliminado',
          body: `${sanitizeTitle(actorName)} eliminó: ${deletedTitles}`,
          data: { actorId: user.id, eventIds: deletedEventIds.join(',') },
          deepLink: `${process.env.APP_DEEP_LINK_SCHEME || 'dommussagenda'}://home`,
        }).catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/by-code/:familyCode', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const familyCode = req.params.familyCode;
    const snapshot = await getFamilySnapshotByCode(familyCode);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    next(error);
  }
});

// Delta/pagination for reinstall & reconciliation.
// Devuelve sólo eventos cuyo `updatedAt` es mayor al `since`.
router.get('/updates/:familyCode', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const familyCode = req.params.familyCode;
    const sinceRaw = (req.query.since as string | undefined) ?? '0';
    const offset = Number((req.query.offset as string | undefined) ?? '0');
    const limit = Number((req.query.limit as string | undefined) ?? '200');

    const sinceMs = sinceRaw === '0' ? 0 : new Date(sinceRaw).getTime();
    const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 200;

    const snapshot = await getFamilySnapshotByCode(familyCode);
    const events: any[] = (snapshot as any)?.events || [];

    const filtered = events
      .filter((e) => getEventUpdatedAtMs(e) > sinceMs)
      .sort((a, b) => {
        const da = getEventUpdatedAtMs(a);
        const db = getEventUpdatedAtMs(b);
        if (da !== db) return da - db; // ascending for deterministic offset
        const ida = String(a?.id ?? '');
        const idb = String(b?.id ?? '');
        return ida.localeCompare(idb);
      });

    const slice = filtered.slice(safeOffset, safeOffset + safeLimit);
    const hasMore = safeOffset + safeLimit < filtered.length;

    res.json({
      success: true,
      data: {
        environment: (snapshot as any).environment,
        events: slice,
        hasMore,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as familyRoutes };

