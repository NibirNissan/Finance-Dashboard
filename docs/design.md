# Expanse Tracker Design System

## UI/UX principles

Expanse Tracker uses a “sun-warmed paper + blue-ink ledger” visual language:

- Calm, focused, and personal rather than loud or gamified
- Financial numbers are prominent and easy to scan
- Category colors provide distinction without overwhelming the page
- Forms prioritize quick entry and clear validation
- Empty, loading, error, and selected-month states remain understandable
- Destructive actions require an explicit confirmation
- Long content must not break alignment or push important values off-screen
- BDT (`৳`) is the only currency displayed in the application UI

## Typography

The application uses three complementary typefaces:

- **DM Sans** for interface labels, controls, body copy, and data rows
- **Instrument Serif** for editorial-style headings and section titles
- **DM Mono** for money, dates, and other ledger-like values

Headings use the serif face sparingly to create a warm editorial hierarchy. Numbers use the monospace face so totals and amounts align visually.

## Light mode palette

The light theme is a warm paper background with dark blue ink:

- Background: `hsl(42 35% 94%)`
- Foreground: `hsl(213 35% 18%)`
- Cards: `hsl(40 33% 97%)`
- Borders: `hsl(39 20% 84%)`
- Primary blue ink: `hsl(210 34% 22%)`
- Muted surface: `hsl(42 27% 89%)`
- Muted text: `hsl(210 15% 47%)`
- Accent gold: `hsl(43 91% 65%)`
- Destructive red: `hsl(5 66% 51%)`

Category accents:

- Utilities: `#42647b`
- Bazar: `#c49435`
- One-Time: `#bf6654`

## Dark mode palette

Dark mode is functional, toggled with the moon/sun control, and persisted in `localStorage` under `expanse-theme`. It uses deep navy surfaces while retaining warm paper text and gold accents:

- Background: `hsl(213 35% 12%)`
- Foreground: `hsl(40 33% 94%)`
- Cards: `hsl(213 30% 16%)`
- Borders: `hsl(210 22% 28%)`
- Primary gold: `hsl(43 91% 65%)`
- Secondary surface: `hsl(210 24% 21%)`
- Muted text: `hsl(210 12% 68%)`
- Sidebar: `hsl(213 36% 9%)`

The first load respects the system color preference when no saved theme exists.

## Strict mobile-first rules

Mobile behavior is a product requirement, not a later enhancement:

- Use Tailwind responsive classes with mobile as the base and `sm:` / `md:` for larger layouts.
- Use `p-4`-equivalent outer page padding on mobile so the dashboard uses the available width efficiently.
- Scale the main greeting heading down on mobile (`text-2xl` base, larger at `sm:` and `md:`).
- Scale the total balance down on mobile (`text-4xl` base, larger at `sm:` and `md:`) to avoid awkward wrapping.
- The add-expense modal is `95vw` on mobile with a small viewport margin; it becomes a centered, constrained card on larger screens.
- Every input, date field, category button, textarea, and primary form action is at least 44px tall for comfortable tapping.
- Mobile list rows use `min-w-0`, a shrinking content column, `truncate` titles/notes, and non-shrinking amounts/actions so prices remain aligned.
- The desktop sidebar is hidden on mobile and restored at `md:`.
- Avoid horizontal overflow; controls may wrap when necessary.
- Keep modal and action controls reachable within the mobile viewport.