# Expanse Tracker

A personal finance dashboard for logging expenses and understanding monthly spending across utilities, groceries, and one-time costs.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/expanse-tracker` — responsive React/Vite dashboard.
- `artifacts/api-server/src/routes/expenses.ts` — validated expense CRUD and monthly summary endpoints.
- `lib/api-spec/openapi.yaml` — source of truth for the expense API contract.
- `lib/db/src/schema/expenses.ts` — PostgreSQL expense model and enums.

## Architecture decisions

- Calendar dates are stored as PostgreSQL `date` values so expense days are not shifted by timezone conversions.
- The shared API server and generated OpenAPI clients are used for all expense reads and mutations.
- Monthly summaries are calculated from the database by category and expense type.

## Product

- Shows current-month total and transaction count.
- Supports quick add, editing, deletion, and category filtering.
- Visualizes Utilities, Bazar, and One-Time spending with live database-backed totals.

## User preferences

 - Prefer a calm, modern dashboard with clear financial detail and responsive behavior.

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- Normalize date-only API values before display because generated responses may be ISO timestamp-shaped.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
