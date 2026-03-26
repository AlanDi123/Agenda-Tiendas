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

  const exists = await db.execute(sql.raw(`
    SELECT id FROM ${TABLE_NAME}
    WHERE family_code = '${familyCode.replace(/'/g, "''")}'
    LIMIT 1
  `));

  const payloadJson = JSON.stringify(params.payload).replace(/'/g, "''");
  const ownerEmail = params.ownerEmail.toLowerCase().replace(/'/g, "''");
  const ownerId = params.ownerId.replace(/'/g, "''");

  if ((exists as any).rows?.length > 0) {
    await db.execute(sql.raw(`
      UPDATE ${TABLE_NAME}
      SET owner_id='${ownerId}',
          owner_email='${ownerEmail}',
          payload='${payloadJson}'::jsonb,
          version=version+1,
          updated_at=NOW()
      WHERE family_code='${familyCode.replace(/'/g, "''")}'
    `));
    return;
  }

  await db.execute(sql.raw(`
    INSERT INTO ${TABLE_NAME} (owner_id, owner_email, family_code, payload, version)
    VALUES ('${ownerId}', '${ownerEmail}', '${familyCode.replace(/'/g, "''")}', '${payloadJson}'::jsonb, 1)
  `));
}

export async function getFamilySnapshotByCode(familyCode: string): Promise<SnapshotPayload> {
  await ensureTable();
  const normCode = familyCode.trim().toUpperCase().replace(/'/g, "''");
  const result = await db.execute(sql.raw(`
    SELECT payload
    FROM ${TABLE_NAME}
    WHERE family_code='${normCode}'
    LIMIT 1
  `));

  const row = (result as any).rows?.[0];
  if (!row?.payload) {
    throw createError('Familia no encontrada para ese código', 404, 'FAMILY_NOT_FOUND');
  }

  return row.payload as SnapshotPayload;
}

