/**
 * Database Migration Script
 * Runs SQL migrations for Neon PostgreSQL
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

async function migrate() {
  console.log('🚀 Starting database migration...');

  try {
    // Create enums first
    console.log('Creating enums...');
    const enums = [
      "user_role AS ENUM ('USER', 'OWNER', 'STAFF', 'ADMIN')",
      "plan_type AS ENUM ('FREE', 'PREMIUM_MONTHLY', 'PREMIUM_YEARLY')",
      "plan_status AS ENUM ('active', 'expired', 'grace_period', 'cancelled')",
      "subscription_status AS ENUM ('pending', 'active', 'failed', 'refunded', 'cancelled')",
      "payment_status AS ENUM ('pending', 'approved', 'rejected', 'refunded', 'cancelled', 'in_process')",
      "discount_type AS ENUM ('percentage', 'fixed')",
    ];

    for (const enumDef of enums) {
      try {
        await sql(`
          DO $$ BEGIN
            CREATE TYPE ${enumDef};
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);
      } catch (e) {
        // Ignore if already exists
      }
    }

    // Create users table
    console.log('Creating users table...');
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        email_verified_at TIMESTAMP,
        role user_role NOT NULL DEFAULT 'USER',
        plan_type plan_type NOT NULL DEFAULT 'FREE',
        plan_status plan_status NOT NULL DEFAULT 'active',
        current_period_end TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMP,
        last_login_ip TEXT
      );

      CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
      CREATE INDEX IF NOT EXISTS users_plan_type_idx ON users(plan_type, plan_status);
      CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
    `;

    // Create email_verifications table
    console.log('Creating email_verifications table...');
    await sql`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        verified BOOLEAN NOT NULL DEFAULT false,
        verified_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS email_verifications_user_id_idx ON email_verifications(user_id);
      CREATE INDEX IF NOT EXISTS email_verifications_expires_at_idx ON email_verifications(expires_at);
    `;

    // Create plans table
    console.log('Creating plans table...');
    await sql`
      CREATE TABLE IF NOT EXISTS plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        type plan_type NOT NULL,
        price_usd DECIMAL(10,2) NOT NULL,
        price_ar DECIMAL(15,2),
        features_json TEXT NOT NULL,
        interval TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS plans_type_idx ON plans(type);
      CREATE UNIQUE INDEX IF NOT EXISTS plans_name_idx ON plans(name);
    `;

    // Create subscriptions table
    console.log('Creating subscriptions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
        status subscription_status NOT NULL DEFAULT 'pending',
        start_date TIMESTAMP NOT NULL DEFAULT NOW(),
        end_date TIMESTAMP,
        is_lifetime BOOLEAN NOT NULL DEFAULT false,
        external_payment_id TEXT UNIQUE,
        payment_gateway TEXT NOT NULL DEFAULT 'mercadopago',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
      CREATE INDEX IF NOT EXISTS subscriptions_external_payment_id_idx ON subscriptions(external_payment_id);
      CREATE INDEX IF NOT EXISTS subscriptions_is_lifetime_idx ON subscriptions(is_lifetime);
    `;

    // Create payments table
    console.log('Creating payments table...');
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
        amount_ars DECIMAL(15,2) NOT NULL,
        amount_usd DECIMAL(10,2),
        currency TEXT NOT NULL DEFAULT 'ARS',
        status payment_status NOT NULL DEFAULT 'pending',
        gateway TEXT NOT NULL DEFAULT 'mercadopago',
        external_payment_id TEXT UNIQUE,
        preference_id TEXT,
        discount_code TEXT,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        metadata TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id);
      CREATE INDEX IF NOT EXISTS payments_external_payment_id_idx ON payments(external_payment_id);
      CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
      CREATE INDEX IF NOT EXISTS payments_gateway_idx ON payments(gateway);
      CREATE INDEX IF NOT EXISTS payments_created_at_idx ON payments(created_at);
    `;

    // Create discount_codes table
    console.log('Creating discount_codes table...');
    await sql`
      CREATE TABLE IF NOT EXISTS discount_codes (
        code TEXT PRIMARY KEY,
        type discount_type NOT NULL DEFAULT 'percentage',
        value DECIMAL(10,2) NOT NULL,
        currency TEXT,
        max_uses INTEGER,
        per_user_limit INTEGER,
        applicable_plans TEXT NOT NULL,
        expires_at TIMESTAMP,
        total_used INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS discount_codes_active_idx ON discount_codes(active, expires_at);
    `;

    // Create discount_usages table
    console.log('Creating discount_usages table...');
    await sql`
      CREATE TABLE IF NOT EXISTS discount_usages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        discount_code TEXT NOT NULL REFERENCES discount_codes(code) ON DELETE CASCADE,
        payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS discount_usages_user_id_idx ON discount_usages(user_id);
      CREATE INDEX IF NOT EXISTS discount_usages_discount_code_idx ON discount_usages(discount_code);
      CREATE UNIQUE INDEX IF NOT EXISTS discount_usages_user_code_unique ON discount_usages(user_id, discount_code);
    `;

    // Create payment_logs table
    console.log('Creating payment_logs table...');
    await sql`
      CREATE TABLE IF NOT EXISTS payment_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        gateway TEXT NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL,
        raw_payload TEXT NOT NULL,
        signature TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS payment_logs_user_id_idx ON payment_logs(user_id);
      CREATE INDEX IF NOT EXISTS payment_logs_gateway_idx ON payment_logs(gateway);
      CREATE INDEX IF NOT EXISTS payment_logs_status_idx ON payment_logs(status);
      CREATE INDEX IF NOT EXISTS payment_logs_created_at_idx ON payment_logs(created_at);
    `;

    // Create webhook_events table
    console.log('Creating webhook_events table...');
    await sql`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        gateway TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payment_id TEXT NOT NULL,
        status TEXT NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency TEXT NOT NULL,
        signature TEXT NOT NULL,
        raw_payload TEXT NOT NULL,
        processed BOOLEAN NOT NULL DEFAULT false,
        error TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS webhook_events_gateway_payment_idx ON webhook_events(gateway, payment_id);
      CREATE INDEX IF NOT EXISTS webhook_events_processed_idx ON webhook_events(processed);
      CREATE INDEX IF NOT EXISTS webhook_events_created_at_idx ON webhook_events(created_at);
    `;

    // Create refresh_tokens table
    console.log('Creating refresh_tokens table...');
    await sql`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        device_id TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON refresh_tokens(token);
      CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx ON refresh_tokens(expires_at);
    `;

    // Create updated_at trigger function
    console.log('Creating updated_at trigger...');
    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `;

    // Apply updated_at triggers
    await sql`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
      CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
      CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
      CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_discount_codes_updated_at ON discount_codes;
      CREATE TRIGGER update_discount_codes_updated_at BEFORE UPDATE ON discount_codes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    console.log('✅ Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

migrate();
