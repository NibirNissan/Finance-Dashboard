-- Migration: expense type + bKash/Nagad manual payment flow
-- Apply with: psql $DATABASE_URL -f lib/db/migrations/001_payment_requests.sql
-- All statements are idempotent (safe to run multiple times).

-- 1. expense_type enum (used by expenses.type column)
DO $$ BEGIN
  CREATE TYPE expense_type AS ENUM ('recurring', 'one-time');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add type column to expenses (backfills existing rows to 'one-time')
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS type expense_type NOT NULL DEFAULT 'one-time';

-- 3. Payment method enum
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('bKash', 'Nagad');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Payment status enum
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. bKash / Nagad recipient numbers in system_settings
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS bkash_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nagad_number TEXT NOT NULL DEFAULT '';

-- 6. Payment requests table
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

-- 7. Enforce one pending request per user at the database level
CREATE UNIQUE INDEX IF NOT EXISTS payment_requests_one_pending_per_user
  ON payment_requests (user_id)
  WHERE status = 'pending';
