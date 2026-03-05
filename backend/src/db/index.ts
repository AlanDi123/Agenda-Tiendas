/**
 * Database Connection Module
 * Uses Neon serverless PostgreSQL with Drizzle ORM
 * Compatible with 32-bit Node.js environments
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// ============================================
// CONFIGURATION
// ============================================

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[Database] DATABASE_URL environment variable is not set');
  throw new Error('DATABASE_URL environment variable is required');
}

// ============================================
// CONNECTION
// ============================================

// Create Neon serverless SQL client
const sql = neon(DATABASE_URL);

// Create Drizzle ORM instance with schema
export const db = drizzle(sql, { schema });

// ============================================
// HEALTH CHECK
// ============================================

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    console.log('[Database] Connection successful');
    return true;
  } catch (error) {
    console.error('[Database] Connection failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

// ============================================
// EXPORTS
// ============================================

export { sql };
export default db;
