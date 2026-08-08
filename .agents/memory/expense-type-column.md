---
name: expense-type column sync
description: The DB expenses table has a type expense_type enum column that must be kept in sync across Drizzle schema, api-zod, and api-client-react schemas.
---

# expense_type Column — Multi-layer sync requirement

## The rule
Any change to the `expenses` table's `type` column (or any other column) must be reflected in ALL FOUR layers:
1. `lib/db/src/schema/expenses.ts` — Drizzle column definition (`expenseTypeEnum`, `.type` field)
2. `lib/api-zod/src/generated/api.ts` — Zod validation schemas (`CreateExpenseBody`, `UpdateExpenseBody`, `ListExpensesResponseItem`, `CreateExpenseResponse`, `UpdateExpenseResponse`)
3. `lib/api-zod/src/generated/types/` — TS interface files (`expense.ts`, `expenseInput.ts`, `expenseType.ts`, `expenseInputType.ts`) + `index.ts` exports
4. `lib/api-client-react/src/generated/api.schemas.ts` — TS interfaces used by the frontend (`Expense`, `ExpenseInput`)

**Why:** When any layer is missing a field, Drizzle produces broken SQL (e.g. `CASE WHEN  = 'recurring'`) and every expenses endpoint returns 500. This is silent — the build succeeds but runtime queries fail.

## Enum values
`expense_type`: `'recurring'` | `'one-time'`  
Default: `'one-time'`

## How to apply
When adding new columns to `expenses` in Drizzle schema, immediately update api-zod and api-client-react schemas in the same commit. The generated type files in `lib/api-zod/src/generated/types/index.ts` must export all type files — removing entries causes build-breaking missing module errors.

## Dashboard form
`artifacts/expanse-tracker/src/pages/dashboard.tsx` — `ExpenseForm` component — has a two-button toggle (One-time / Recurring) that sets `form.type`. Default is `"one-time"`. When editing, `initial.type` is pre-filled.
