# Expanse Tracker Project Memory

This file is the durable project state. Before writing new code, read `docs/mission.md`, `docs/architecture.md`, `docs/design.md`, and this file. After every significant task, update this file and update `docs/architecture.md` or `docs/design.md` whenever the schema or design rules change.

## What is working (Current stable features)

- Responsive React/Vite dashboard with the calm paper-and-blue-ink visual language.
- Expense CRUD through the shared Express API and PostgreSQL database.
- Expense categories: Utilities, Bazar, and One-Time.
- Current expense model includes title, positive amount, category, calendar date, optional note, id, and created timestamp.
- Frequency / recurring-vs-one-time data has been removed from the intended model, API contract, frontend state, monthly summary, list, and report.
- Monthly navigation updates the selected month, total, transaction count, category breakdown, expense rows, and empty states.
- Category filtering works for the selected month.
- Monthly totals and category totals are calculated by the backend.
- Bangladesh localization is active throughout the dashboard using BDT / `৳` formatting and `en-BD` number formatting.
- Light and dark mode toggle works and persists the preference in local storage.
- Add and edit forms include an optional Note textarea below category selection.
- Mobile layout uses compact outer padding, smaller mobile typography, a 95vw modal, 44px minimum controls, and truncation for long expense titles and notes.
- Client-side monthly PDF export includes selected-month totals, category breakdown, and itemized expenses with notes.
- OpenAPI remains the source of truth, with generated Zod schemas and React Query hooks.
- Date-only values are normalized before display or date-input binding to avoid timezone shifts.

## Known Issues (Bugs or UI glitches)

- Existing database rows from before the frequency removal may require the database schema push/migration before the running API can use the new `note` column and no longer reference the old frequency column.
- PDF generation relies on browser-side libraries and may produce a larger JavaScript bundle on first load.
- The dashboard currently uses a fixed greeting name rather than a user account/profile name.
- There is no authentication or multi-user ownership model yet; the app is currently a personal/shared ledger.
- Mobile behavior should continue to be checked at very narrow widths when adding new controls or fields.

## Next Steps (What we are building next)

- Apply and verify the PostgreSQL schema update in the development environment.
- Restart the API and web workflows after the schema update and run typecheck/build checks.
- Perform a live mobile browser pass for add/edit expense, note persistence, month navigation, dark mode, and PDF export.
- Add automated API and UI coverage for note creation, note editing/clearing, frequency-field rejection, and narrow-screen alignment.
- Decide whether to add authentication and per-user expense ownership before expanding the product beyond a personal ledger.