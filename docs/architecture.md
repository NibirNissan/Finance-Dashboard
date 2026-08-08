# Expanse Tracker Architecture

## Technology stack

The project is a pnpm workspace with a React/Vite frontend and a shared Express API.

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend runtime:** Node.js
- **API:** Express 5
- **Database:** PostgreSQL using the existing Replit database
- **ORM and validation:** Drizzle ORM, Drizzle Zod, Zod
- **API contract:** OpenAPI 3.1
- **Generated clients:** Orval-generated Zod server schemas and React Query hooks
- **Client data fetching:** TanStack React Query
- **PDF reports:** `jspdf` and `jspdf-autotable`
- **Currency:** BDT / Bangladeshi Taka (`৳`) only

> MongoDB was part of the original stack preference, but this workspace already has a configured PostgreSQL/Drizzle setup. The application uses PostgreSQL in the implemented architecture; MongoDB is not used.

## Folder structure

```text
.
├── artifacts/
│   ├── api-server/
│   │   └── src/routes/          # Express route handlers
│   ├── expanse-tracker/
│   │   └── src/
│   │       ├── pages/            # Dashboard screens
│   │       ├── components/       # Shared UI components
│   │       └── index.css         # Theme tokens and global styles
│   └── mockup-sandbox/           # Isolated component preview artifact
├── lib/
│   ├── api-spec/                 # OpenAPI source and Orval config
│   ├── api-zod/                 # Generated server validation schemas
│   ├── api-client-react/        # Generated React Query client and types
│   └── db/
│       └── src/schema/           # Drizzle PostgreSQL schema
├── docs/                         # Project brain and durable product documentation
└── replit.md                     # Workspace overview and operating notes
```

## Expense database schema

The `expenses` PostgreSQL table is the source of truth for expense records:

| Field | Database type | Required | Description |
| --- | --- | --- | --- |
| `id` | serial / integer | Yes | Primary key |
| `title` | text | Yes | Expense name, trimmed and validated |
| `amount` | numeric(12, 2) | Yes | Positive expense amount |
| `category` | `expense_category` enum | Yes | `Utilities`, `Bazar`, or `One-Time` |
| `date` | PostgreSQL `date` | Yes | Calendar date stored without timezone shifting |
| `note` | text | No | Optional user-entered context, up to 500 characters at the API boundary |
| `createdAt` | timestamp with timezone | Yes | Server-generated creation timestamp |

There is **no frequency field** and no recurring/one-time expense-type enum. Frequency is not part of the database schema, API payloads, frontend state, monthly summary, expense list, or PDF report.

## API surface

The shared API is served under `/api`:

- `GET /expenses` — list expenses
- `POST /expenses` — create an expense
- `PATCH /expenses/:id` — update an expense
- `DELETE /expenses/:id` — delete an expense
- `GET /expenses/summary/monthly?month=YYYY-MM` — monthly total, count, and category totals
- `GET /healthz` — health check

OpenAPI is the contract source. After changing `lib/api-spec/openapi.yaml`, run:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Do not hand-edit generated API types.