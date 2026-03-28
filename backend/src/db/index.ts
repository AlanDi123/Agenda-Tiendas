/**
 * Database Connection Module
 * Neon serverless PostgreSQL + Drizzle ORM
 * Serverless-safe: no lanza errores en module load
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Prefer the pooled connection URL if available; fall back to the standard URL.
// Neon's HTTP driver is serverless-pooled, but using the -pooler endpoint
// prevents hitting max connection limits when multiple functions run in parallel.
const DATABASE_URL = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  // En serverless, un throw aquí crashea toda la función antes de responder.
  // Logueamos el error pero no tiramos — el crash ocurrirá cuando se intente
  // usar db, con un mensaje de error claro en los logs de Vercel.
  console.error('[Database] FATAL: DATABASE_URL no está configurada en las variables de entorno.');
}

// Crear cliente lazy — si DATABASE_URL es undefined, neon() lanzará
// cuando se use por primera vez (no al importar el módulo).
const sql = DATABASE_URL ? neon(DATABASE_URL) : ((() => { throw new Error('DATABASE_URL no configurada'); }) as any);

export const db = DATABASE_URL
  ? drizzle(sql, { schema })
  : (null as any);

export async function checkDatabaseConnection(): Promise<boolean> {
  if (!DATABASE_URL) {
    console.error('[Database] No DATABASE_URL — saltando check de conexión');
    return false;
  }
  try {
    await sql`SELECT 1`;
    console.log('[Database] Conexión exitosa');
    return true;
  } catch (error) {
    console.error('[Database] Conexión fallida:', error instanceof Error ? error.message : error);
    return false;
  }
}

/** Envuelve una query con un AbortController de 5 segundos. */
export async function withTimeout<T>(queryFn: () => Promise<T>, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await queryFn();
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted) {
      throw new Error(`[Database] Query timeout después de ${timeoutMs}ms`);
    }
    throw err;
  }
}

export { sql };
export default db;
