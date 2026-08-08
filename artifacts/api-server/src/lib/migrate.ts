import { pool } from "@workspace/db";
import { logger } from "./logger";

// Idempotent migration SQL — safe to run on every startup.
// All statements use IF NOT EXISTS / DO EXCEPTION guards.
const MIGRATION_SQL = `
-- expense_type enum (used by expenses.type column)
DO $$ BEGIN
  CREATE TYPE expense_type AS ENUM ('recurring', 'one-time');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add type column to expenses (backfills existing rows to 'one-time')
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS type expense_type NOT NULL DEFAULT 'one-time';

-- Payment method enum
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('bKash', 'Nagad');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payment status enum
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- bKash / Nagad recipient numbers in system_settings
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS bkash_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nagad_number TEXT NOT NULL DEFAULT '';

-- Payment requests table
CREATE TABLE IF NOT EXISTS payment_requests (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
  plan_id        INTEGER NOT NULL REFERENCES pricing_plans(id)  ON DELETE CASCADE,
  payment_method payment_method  NOT NULL,
  sender_number  TEXT NOT NULL,
  trx_id         TEXT NOT NULL UNIQUE,
  status         payment_status NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One pending request per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS payment_requests_one_pending_per_user
  ON payment_requests (user_id)
  WHERE status = 'pending';
`;

/**
 * Runs the idempotent schema migration on every server start using the shared
 * connection pool. Covers both the expense-type column and the payment-requests
 * table, ensuring the deployed schema matches the Drizzle definitions without
 * requiring a manual drizzle-kit push.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(MIGRATION_SQL);
    logger.info("Database migrations applied");
  } finally {
    client.release();
  }
}
