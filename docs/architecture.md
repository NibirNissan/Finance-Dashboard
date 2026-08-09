# Expanse Tracker — Architecture

## Overview

Expanse Tracker is a full-stack SaaS expense tracking application built as a pnpm monorepo. It supports personal and family expense logging, manual bKash/Nagad payment verification, and role-based admin management.

---

## Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend (web) | React 19 + Vite + Tailwind CSS v4 + Wouter |
| Frontend (mobile) | Expo (React Native) |
| API server | Express 5 (Node.js) |
| Database | **PostgreSQL 16** (Replit managed) |
| ORM | Drizzle ORM + drizzle-zod |
| Auth | Replit-managed Clerk (Google OAuth + email/password) |
| Validation | Zod v4 |
| API client | TanStack Query + orval-generated hooks |

---

## Database

**This project uses PostgreSQL — not MongoDB.**

The database connection is managed by Drizzle ORM using the `DATABASE_URL` environment variable (a standard PostgreSQL connection string). Replit provisions and manages the Postgres instance automatically.

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

### Why PostgreSQL?
- The entire schema uses Drizzle ORM with typed tables, enums, and relations
- Every API route, query, migration, and type depends on Postgres-specific features (enums, timestamps with timezone, numeric precision)
- Switching to a document database (e.g. MongoDB) would require a full rewrite of every schema, query, and migration in the codebase

### Schema location
All table definitions live in `lib/db/src/schema/`:

| File | Table |
|---|---|
| `users.ts` | `users` — Clerk auth, roles, subscription, account type |
| `expenses.ts` | `expenses` — per-user expense records with type enum |
| `categories.ts` | `categories` — admin-managed categories |
| `pricing-plans.ts` | `pricing_plans` — subscription tiers |
| `system-settings.ts` | `system_settings` — global config incl. bKash/Nagad numbers |
| `payment-requests.ts` | `payment_requests` — bKash/Nagad manual payment submissions |
| `admin-logs.ts` | `admin_logs` — audit trail for admin actions |

### Migrations
Because Drizzle Kit's interactive push hangs when new PG enum types are involved, schema changes are applied via raw SQL:
```bash
psql "$DATABASE_URL" << 'EOF'
-- SQL here
EOF
```

---

## Packages

```
artifacts/
  api-server/          Express 5 API (port from $PORT)
  expanse-tracker/     React/Vite web app
  expanse-tracker-mobile/  Expo mobile app
lib/
  db/                  Drizzle schema + db client (exports usersTable, etc.)
  api-zod/             Zod validation schemas (server-side)
  api-client-react/    TanStack Query hooks (client-side, orval-generated)
```

---

## Auth Flow

1. Users sign in via Clerk (Google OAuth or email)
2. On first authenticated request, the API's `requireAuth` middleware JIT-provisions a local `users` row linked by `clerk_user_id`
3. New users (no `account_type` set) are redirected to `/onboarding` to pick "Single Person" or "Family" before reaching the dashboard
4. Session cookies carry the Clerk JWT — no Bearer tokens needed on the web frontend

---

## Payment Flow

1. User selects a plan on `/pricing` and chooses bKash or Nagad
2. They send money to the admin's number (fetched from `system_settings`) and submit a Transaction ID via the checkout modal
3. A `payment_requests` row is created with `status = 'pending'`
4. Admin reviews submissions in the Verification Queue tab of `/admin`
5. On approval, the user's `subscription_plan` is updated and an `admin_logs` entry is recorded
6. The user sees a dashboard banner ("pending" / "rejected") until their plan activates

---

## Deployment target

The application is designed to deploy on **Render** (or similar Node.js-compatible platforms). Required environment variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `CLERK_PUBLISHABLE_KEY` | Clerk public key |
| `CLERK_SECRET_KEY` | Clerk server-side secret |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk public key for Vite frontend build |
| `SESSION_SECRET` | Express session secret |
| `PORT` | Port for the API server (set automatically by Render) |
