/**
 * Push Notification Service — Firebase Cloud Messaging (FCM)
 *
 * Características:
 * - Envío por userId (multi-device)
 * - Limpieza automática de dead tokens
 * - Notificaciones silenciosas (data-only)
 * - Agrupación / debounce en notification_logs
 * - Soporte de deep links en el payload
 */

import { eq, and, inArray } from 'drizzle-orm';
import db from '../db';
import { deviceTokens, notificationLogs, userPreferences } from '../db/schema';
import { logger } from '../middleware/requestLogger';

let admin: typeof import('firebase-admin') | null = null;

async function getFirebaseAdmin() {
  if (admin) return admin;
  try {
    admin = await import('firebase-admin');
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      logger.warn('[PushService] FIREBASE_SERVICE_ACCOUNT_JSON no configurado — push desactivado');
      return null;
    }

    if (!admin.apps?.length) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    return admin;
  } catch (err) {
    logger.error({ err }, '[PushService] Error inicializando Firebase Admin');
    return null;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Si true, envía data-only (silent push para background sync) */
  silent?: boolean;
  /** Deep link destino, ej: dommussagenda://event/uuid */
  deepLink?: string;
  /** Para acciones rápidas en Android */
  actions?: Array<{ id: string; label: string }>;
}

/** Envía push a todos los dispositivos activos de un usuario */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; removed: number }> {
  const firebaseAdmin = await getFirebaseAdmin();
  if (!firebaseAdmin) return { sent: 0, removed: 0 };

  type TokenRow = { id: string; token: string };
  const tokens: TokenRow[] = await db.select({ id: deviceTokens.id, token: deviceTokens.token })
    .from(deviceTokens)
    .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.isActive, true)));

  if (!tokens.length) return { sent: 0, removed: 0 };

  const data: Record<string, string> = {
    ...(payload.data ?? {}),
    ...(payload.deepLink ? { deepLink: payload.deepLink } : {}),
    ...(payload.actions ? { actions: JSON.stringify(payload.actions) } : {}),
  };

  const message: import('firebase-admin/messaging').MulticastMessage = {
    tokens: tokens.map((t) => t.token),
    data,
    android: {
      priority: 'high',
      ...(payload.silent
        ? {}
        : {
          notification: {
            title: payload.title,
            body: payload.body,
            sound: 'default',
          },
        }),
    },
    apns: {
      payload: {
        aps: payload.silent
          ? { contentAvailable: true }
          : { alert: { title: payload.title, body: payload.body }, sound: 'default', badge: 1 },
      },
    },
  };

  const response = await firebaseAdmin.messaging().sendEachForMulticast(message);

  const deadTokenIds: string[] = [];
  response.responses.forEach((r: { success: boolean; error?: { code?: string } }, idx: number) => {
    if (!r.success) {
      const errCode = r.error?.code;
      if (
        errCode === 'messaging/registration-token-not-registered' ||
        errCode === 'messaging/invalid-registration-token'
      ) {
        deadTokenIds.push(tokens[idx].id);
      }
    }
  });

  // Limpiar dead tokens
  if (deadTokenIds.length) {
    await db.update(deviceTokens)
      .set({ isActive: false, updatedAt: new Date() })
      .where(inArray(deviceTokens.id, deadTokenIds));
    logger.info({ deadTokenIds }, '[PushService] Dead tokens desactivados');
  }

  return { sent: response.successCount, removed: deadTokenIds.length };
}

/** Envía push a múltiples usuarios a la vez */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  await Promise.allSettled(userIds.map((id) => sendPushToUser(id, payload)));
}

/** Registra en notification_logs y dispara push asíncronamente */
export async function notifyUser(opts: {
  userId: string;
  environmentId?: string;
  type: 'event_created' | 'event_updated' | 'event_deleted' | 'family_join' | 'role_changed' | 'payment_failed' | 'payment_success' | 'expiry_warning' | 'new_login' | 'weekly_summary';
  title: string;
  body: string;
  data?: Record<string, string>;
  deepLink?: string;
  silent?: boolean;
}): Promise<void> {
  // 1. Persistir en notification_logs para el Centro de notificaciones
  await db.insert(notificationLogs).values({
    userId: opts.userId,
    environmentId: opts.environmentId ?? null,
    type: opts.type,
    title: opts.title,
    body: opts.body,
    data: opts.data ?? null,
  }).catch((err: unknown) => logger.error({ err }, '[PushService] Error insertando notification_log'));

  // 2. Verificar preferencias del usuario (no molestar)
  const prefsRows = await db.select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, opts.userId))
    .limit(1)
    .catch(() => []);
  const prefs = prefsRows[0] ?? null;

  if (prefs && !prefs.pushEnabled) return;

  // 3. Disparar push asíncronamente
  setImmediate(() => {
    void sendPushToUser(opts.userId, {
      title: opts.title,
      body: opts.body,
      data: opts.data,
      deepLink: opts.deepLink,
      silent: opts.silent,
    });
  });
}

/** Push silent para forzar sync en background */
export async function sendSilentSync(userId: string): Promise<void> {
  await sendPushToUser(userId, {
    title: '',
    body: '',
    data: { action: 'BACKGROUND_SYNC' },
    silent: true,
  });
}
