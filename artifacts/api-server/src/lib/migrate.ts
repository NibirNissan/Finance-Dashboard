import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Runs idempotent schema migrations on every server start using the shared
 * connection pool (SSL already configured for cloud Postgres providers).
 *
 * Every statement uses IF NOT EXISTS / DO…EXCEPTION guards — safe to replay
 * against a database that already has the correct schema.
 *
 * Column names and types here must stay in sync with lib/db/src/schema/*.ts.
 */
const MIGRATION_SQL = `
-- ── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('Single Person', 'Family');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

-- ── users ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                  SERIAL PRIMARY KEY,
  clerk_user_id       TEXT UNIQUE,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  password_hash       TEXT,
  phone               TEXT,
  account_type        account_type,
  role                user_role   NOT NULL DEFAULT 'user',
  subscription_plan   TEXT        NOT NULL DEFAULT 'free',
  subscription_expiry TIMESTAMPTZ,
  status              user_status NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── categories ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id      SERIAL PRIMARY KEY,
  name    TEXT    NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- ── expenses ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  title      TEXT         NOT NULL,
  amount     NUMERIC(12,2) NOT NULL,
  category   TEXT         NOT NULL,
  date       DATE         NOT NULL,
  type       expense_type NOT NULL DEFAULT 'one-time',
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── pricing_plans ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pricing_plans (
  id                  SERIAL PRIMARY KEY,
  plan_name           TEXT          NOT NULL,
  slug                TEXT          NOT NULL UNIQUE,
  price               NUMERIC(10,2) NOT NULL,
  duration_in_months  INTEGER       NOT NULL,
  features            TEXT[]        NOT NULL DEFAULT '{}',
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order          INTEGER       NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── system_settings ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_settings (
  id                       SERIAL PRIMARY KEY,
  announcement_text        TEXT    NOT NULL DEFAULT '',
  is_announcement_active   BOOLEAN NOT NULL DEFAULT FALSE,
  allow_registrations      BOOLEAN NOT NULL DEFAULT TRUE,
  bkash_number             TEXT    NOT NULL DEFAULT '',
  nagad_number             TEXT    NOT NULL DEFAULT '',
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed one settings row if the table is empty
INSERT INTO system_settings (id)
  SELECT 1
  WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE id = 1);

-- ── payment_requests ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_requests (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER        NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
  plan_id        INTEGER        NOT NULL REFERENCES pricing_plans(id)  ON DELETE CASCADE,
  amount         INTEGER        NOT NULL,
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

-- ── admin_logs ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_logs (
  id          SERIAL PRIMARY KEY,
  admin_id    INTEGER NOT NULL,
  action_type TEXT    NOT NULL,
  description TEXT    NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
