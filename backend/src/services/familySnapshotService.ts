import { and, desc, eq, sql } from 'drizzle-orm';
import db from '../db';
import { createError } from '../middleware/errorHandler';

type SnapshotPayload = {
  environment: unknown;
  events: unknown[];
  syncedAt: string;
};

const TABLE_NAME = 'family_snapshots';

let ensured = false;

async function ensureTable(): Promise<void> {
  if (ensured) return;
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL,
      owner_email TEXT NOT NULL,
      family_code TEXT NOT NULL,
      payload JSONB NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));
  await db.execute(sql.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS family_snapshots_family_code_unique
    ON ${TABLE_NAME}(family_code);
  `));
  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS family_snapshots_owner_email_idx
    ON ${TABLE_NAME}(owner_email);
  `));
  ensured = true;
}

export async function saveFamilySnapshot(params: {
  ownerId: string;
  ownerEmail: string;
  familyCode: string;
  payload: SnapshotPayload;
}): Promise<void> {
  await ensureTable();
  const familyCode = params.familyCode.trim().toUpperCase();

  const payloadJson = JSON.stringify(params.payload);
  const ownerEmail = params.ownerEmail.trim().toLowerCase();
  const ownerId = params.ownerId.trim();

  // Upsert parametrizado: el SQL usa placeholders para evitar inyección
  await db.execute(
    sql`
      INSERT INTO ${sql.raw(TABLE_NAME)} (owner_id, owner_email, family_code, payload, version)
      VALUES (${ownerId}, ${ownerEmail}, ${familyCode}, ${payloadJson}::jsonb, 1)
      ON CONFLICT (family_code)
      DO UPDATE SET
        owner_id = EXCLUDED.owner_id,
        owner_email = EXCLUDED.owner_email,
        payload = EXCLUDED.payload,
        version = ${sql.raw(TABLE_NAME)}.version + 1,
        updated_at = NOW()
    `
  );
}

export async function getFamilySnapshotByCode(familyCode: string): Promise<SnapshotPayload> {
  await ensureTable();

  const normCode = familyCode.trim().toUpperCase();
  const result = await db.execute(
    sql`
      SELECT payload
      FROM ${sql.raw(TABLE_NAME)}
      WHERE family_code = ${normCode}
      LIMIT 1
    `
  );

  const row = (result as any).rows?.[0];
  if (!row?.payload) {
    throw createError('Familia no encontrada para ese código', 404, 'FAMILY_NOT_FOUND');
  }

  return row.payload as SnapshotPayload;
}

