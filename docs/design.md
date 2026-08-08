# Design System — Expanse Tracker

## Philosophy

**Calm, deliberate, ledger-inspired.** Every screen should feel like a well-kept notebook — structured, uncluttered, and trustworthy. Animation is used sparingly to signal state changes, never for decoration.

## Color Palette

### Light Mode (default)
| Token | Value | Usage |
|---|---|---|
| Background | `#F5F0E8` (warm cream) | Page background, sidebar base |
| Card / Surface | `#FFFFFF` | Cards, modals, form panels |
| Sidebar | `#1C1917` (stone-900) | Left navigation |
| Sidebar foreground | `#E7E5E4` (stone-200) | Nav labels |
| Sidebar accent | `rgba(255,255,255,0.06)` | Nav item hover |
| Primary (button) | `#1C1917` | Primary CTAs |
| Primary foreground | `#FAFAF9` | Text on primary |
| Accent | `#D97706` (amber-600) | Highlights, active states, brand dot |
| Muted | `#F5F5F4` (stone-100) | Disabled fields, skeleton loaders |
| Border | `#E7E5E4` | Dividers, input borders |
| Destructive | `#EF4444` | Delete actions, error toasts |
| Success | `#10B981` (emerald-500) | Active badges, success states |

### Dark Mode
Dark mode is toggled per-user (stored in `localStorage` key `expanse-theme`). The CSS class `dark` is applied to `<html>`.

| Token | Value |
|---|---|
| Background | `#0C0A09` |
| Card | `#1C1917` |
| Foreground | `#FAFAF9` |
| Muted | `#292524` |
| Border | `#292524` |

### Category Colors
Categories use a predefined palette with fallback for dynamically created ones:

| Category | Color |
|---|---|
| Utilities | `#42647b` (slate-blue) |
| Bazar | `#c49435` (ochre) |
| One-Time | `#bf6654` (terracotta) |
| Dynamic fallback | cycles through `["#42647b","#c49435","#bf6654","#5c7a5e","#7b5c78","#7b6e5c"]` |

### Admin / SaaS Badges
| State | Classes |
|---|---|
| Plan: free | `bg-stone-100 text-stone-500` |
| Plan: monthly | `bg-blue-100 text-blue-700` |
| Plan: yearly | `bg-amber-100 text-amber-700` |
| Status: active | `bg-emerald-100 text-emerald-700` |
| Status: suspended | `bg-red-100 text-red-600` |

## Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Display / headings | Serif (system `Georgia` fallback or `font-serif` Tailwind class) | 700 | `text-2xl` – `text-4xl` |
| Body | System sans-serif (`font-sans`) | 400 | `text-sm` – `text-base` |
| Labels / caps | System sans-serif | 600 | `text-xs`, `tracking-[.15em]`, uppercase |
| Monospace (amounts) | `font-mono` | 500 | `text-sm` – `text-3xl` |
| Currency symbol | `৳` prefix, never abbreviated | — | Matches surrounding text |

## Spacing & Layout

- **Base unit:** `4px` (Tailwind default scale).
- **Card padding:** `p-6` (24px) on desktop, `p-4` (16px) on mobile.
- **Section gap:** `gap-6` between cards in a grid, `gap-4` within a card.
- **Max content width:** `max-w-6xl` (1152px) centered on admin/CMS pages; `max-w-[1240px]` on dashboard.
- **Sidebar width:** `238px` fixed on `md+` breakpoints; hidden (off-canvas or omitted) on mobile.

## Mobile-First Rules

- All interactive targets must be **≥ 44px** tall (Tailwind: `py-2.5` or `h-11` minimum on touch-enabled elements).
- Form inputs: `h-11 rounded-lg` with `px-3` horizontal padding.
- Category and type selector buttons in the expense form: `py-2.5 px-2` minimum.
- No horizontal overflow — all tables wrap or scroll inside their container (`overflow-x-auto`).
- Bottom navigation is NOT implemented; sidebar is the primary nav pattern.

## Component Conventions

### Cards
```
rounded-2xl border border-stone-100 bg-white shadow-sm p-6
```
Hover variant (interactive cards): `hover:shadow-md transition-shadow`

### Primary Button
```
bg-stone-900 text-white hover:bg-stone-800 rounded-xl px-4 py-2.5 font-semibold text-sm transition
```

### Destructive Action
```
hover:bg-red-50 hover:text-red-500 text-stone-300
```
Destructive actions always require a confirmation step (modal or inline confirmation).

### Modals
```
fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4
```
Inner panel: `bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm`

### Badges / Pills
```
text-xs font-medium px-2.5 py-1 rounded-full
```

### Announcement Banner
```
bg-amber-50 border-b border-amber-200 px-6 py-3 text-sm text-amber-800 text-center font-medium
```

## Animation

- **Entry animation:** `.rise` CSS class — `translateY(8px) → 0, opacity 0 → 1`, 400ms ease-out.
- **Stagger delays:** `.delay-1` (100ms), `.delay-2` (200ms) for sibling sections.
- **Progress bars** (category breakdown): `transition-all duration-700` for width changes.
- No infinite animations except: landing page slideshow auto-play, announcement badge pulse dot.

## Landing Page

The public landing page (`/`) uses the same warm-cream background (`#F5F0E8`) and follows a two-column hero layout (copy left, auth card right) on desktop, stacked on mobile. Key elements:

- **Navbar:** logo left, `Pricing | Sign In | Get started` right.
- **Hero auth card:** Sign In / Create Account tab toggle, Google OAuth placeholder button.
- **Below fold:** Feature cards, auto-playing app slideshow (CSS animation), "How It Works" steps.

## Pricing Page

Three-tier layout in a responsive grid (`md:grid-cols-3`). The **last active paid plan** is auto-highlighted with the dark card + "Best Value" badge treatment. Plans are rendered dynamically from the database.

## Admin Panel

Dark header (`bg-stone-900`) + tabbed navigation (`border-b border-stone-200 bg-white`). Tabs: Users | Pricing Manager | Category Manager | Global Settings. Content area uses the standard cream background.
