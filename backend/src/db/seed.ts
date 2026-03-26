/**
 * Database Seed Script
 * Creates initial plans and discount codes
 */

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // ============================================
    // CREATE PLANS
    // ============================================
    console.log('Creating plans...');

    const plans = [
      {
        name: 'Free',
        type: 'FREE',
        priceUsd: '0',
        priceArs: '0',
        features: JSON.stringify(['Hasta 3 perfiles', 'Hasta 10 eventos por día', 'Vista de calendario', 'Código de familia incluido']),
        interval: 'lifetime',
      },
      {
        name: 'Premium Monthly',
        type: 'PREMIUM_MONTHLY',
        priceUsd: '0',
        priceArs: '20000',
        features: JSON.stringify(['Perfiles ilimitados', 'Eventos ilimitados', 'Eventos recurrentes', 'Alarmas y recordatorios', 'Drag & Drop', 'Soporte por email']),
        interval: 'monthly',
      },
      {
        name: 'Premium Yearly',
        type: 'PREMIUM_YEARLY',
        priceUsd: '0',
        priceArs: '220000',
        features: JSON.stringify(['Todo lo del plan mensual', '1 mes gratis', 'Soporte prioritario', 'Actualizaciones anticipadas']),
        interval: 'yearly',
      },
    ];

    for (const plan of plans) {
      await sql`
        INSERT INTO plans (name, type, price_usd, price_ar, features_json, interval)
        VALUES (${plan.name}, ${plan.type}::plan_type, ${plan.priceUsd}, ${plan.priceArs}, ${plan.features}, ${plan.interval})
        ON CONFLICT (name) DO UPDATE SET
          type = EXCLUDED.type,
          price_usd = EXCLUDED.price_usd,
          price_ar = EXCLUDED.price_ar,
          features_json = EXCLUDED.features_json,
          interval = EXCLUDED.interval,
          updated_at = NOW();
      `;
    }

    console.log('✅ Plans created');

    // ============================================
    // CREATE DISCOUNT CODES
    // ============================================
    console.log('Creating discount codes...');

    // MAJESTADESCANOR - Alias especial lifetime (usos infinitos)
    await sql`
      INSERT INTO discount_codes (code, type, value, currency, max_uses, per_user_limit, applicable_plans, expires_at, total_used, active)
      VALUES (
        'MAJESTADESCANOR',
        'percentage'::discount_type,
        100,
        NULL,
        NULL,
        NULL,
        '["PREMIUM_YEARLY"]'::text,
        NULL,
        0,
        true
      )
      ON CONFLICT (code) DO UPDATE SET
        type = EXCLUDED.type,
        value = EXCLUDED.value,
        applicable_plans = EXCLUDED.applicable_plans,
        per_user_limit = EXCLUDED.per_user_limit,
        max_uses = EXCLUDED.max_uses,
        updated_at = NOW();
    `;

    console.log('✅ MAJESTADESCANOR code created');

    console.log('✅ Solo MAJESTADESCANOR habilitado');

    console.log('✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

seed();
