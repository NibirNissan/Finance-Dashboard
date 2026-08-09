import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Runs idempotent schema migrations on every server start using the shared
 * connection pool (which already has SSL enabled for cloud Postgres providers).
 *
 * All statements use IF NOT EXISTS / DO…EXCEPTION guards so they are safe
 * to replay against a database that already has the schema in place.
 */

const MIGRATION_SQL = `
-- ── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE expense_type AS ENUM ('recurring', 'one-time');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('bKash', 'Nagad');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Core tables ────────────────────────────────────────────────────────────
-- IF NOT EXISTS makes these safe to run against an existing database.

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  clerk_id     TEXT NOT NULL UNIQUE,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT,
  account_type TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expenses (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  amount     NUMERIC NOT NULL,
  category   TEXT NOT NULL,
  date       DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pricing_plans (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  price       NUMERIC NOT NULL,
  description TEXT,
  features    TEXT[],
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS system_settings (
  id    SERIAL PRIMARY KEY,
  key   TEXT NOT NULL UNIQUE,
  value TEXT
);

-- ── Additive column migrations ─────────────────────────────────────────────

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS type expense_type NOT NULL DEFAULT 'one-time';

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS bkash_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nagad_number TEXT NOT NULL DEFAULT '';

-- ── Payment requests ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_requests (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER        NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
  plan_id        INTEGER        NOT NULL REFERENCES pricing_plans(id)  ON DELETE CASCADE,
  amount         NUMERIC        NOT NULL,
  payment_method payment_method NOT NULL,
  sender_number  TEXT           NOT NULL,
  transaction_id TEXT           NOT NULL UNIQUE,
  status         payment_status NOT NULL DEFAULT 'pending',
  reviewed_by    INTEGER        REFERENCES users(id),
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_requests_one_pending_per_user
  ON payment_requests (user_id)
  WHERE status = 'pending';

-- ── Admin logs ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_logs (
  id         SERIAL PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  target_id  INTEGER,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(MIGRATION_SQL);
    logger.info("Database migrations applied");
  } catch (err) {
    logger.error({ err }, "Migration failed — aborting startup");
    throw err;
  } finally {
    client.release();
  }
}
