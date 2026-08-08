# Project Memory — Expanse Tracker

> This file tracks the living state of the project. Update it after every significant task.
> Last updated: 2026-08-08

---

## What Is Working (Current Stable Features)

### Authentication — Clerk (Replit-managed)
- [x] **Google OAuth** — one-click sign-in via Google, handled by Clerk
- [x] **Email OTP / Magic Links** — passwordless sign-in via email code, handled by Clerk
- [x] **Email + Password** — traditional sign-in with email verification
- [x] Dedicated `/sign-in` and `/sign-up` pages with branded Clerk UI (stone/amber theme, DM Sans font, custom logo)
- [x] Session cookies — no `localStorage` JWT; Clerk cookies are sent automatically with same-origin API calls
- [x] JIT local user provisioning — on first Clerk sign-in, `requireAuth` fetches identity from Clerk and upserts a local `users` row (matching by email to migrate legacy JWT users)
- [x] `clerkUserId` column added to `users` table — links Clerk identity to local user record
- [x] `requireAuth` middleware uses `getAuth(req)` from `@clerk/express`; attaches `req.localUser` for all downstream routes
- [x] `requireAdmin` middleware checks `req.localUser.role === 'admin'`
- [x] Clerk proxy middleware mounted in Express (production-only forwarding via `/api/__clerk`)

### Expense Tracking
- [x] Create, list, update, delete expenses (auth-scoped per user via Clerk session)
- [x] Category is a dynamic `text` field (driven by the categories CMS)
- [x] Expense type: `recurring` or `one-time`
- [x] Monthly summary: total, transaction count, recurring/one-time split, per-category breakdown
- [x] Month navigation (previous/next) in dashboard
- [x] Filter expenses by category
- [x] PDF export (jsPDF + autotable) with summary + full expense list
- [x] Edit expense inline (PATCH)
- [x] Delete expense with confirmation modal

### Dashboard
- [x] Greeting with user's first name
- [x] Dark/light mode toggle (persisted in `localStorage`)
- [x] Dynamic category colors (predefined palette + fallback cycle)
- [x] "By category" progress bars
- [x] Expense list (8 most recent for selected month) with edit/delete actions
- [x] Announcement banner (shown when admin enables it via Global Settings)
- [x] Sidebar navigation (Expenses, Profile, Pricing, Admin Panel for admins)

### User Profile
- [x] View name, email (read-only — managed by Clerk), account type, phone
- [x] Edit name and phone
- [x] Sign out via Clerk `signOut()`

### Pricing Page (`/pricing`)
- [x] Plans fetched dynamically from `/api/pricing-plans`
- [x] Free (Basic) card always shown as hardcoded first tier
- [x] Last active paid plan auto-highlighted as "Best Value"
- [x] Subscribe modal → `POST /api/subscription/upgrade` (no Bearer token — cookie auth)
- [x] Unauthenticated users redirected to `/sign-in`

### Admin Panel (`/admin`) — 5 Tabs
- [x] **Users tab:** Stats cards (Total Users, Active Subscribers, Revenue ৳), real-time search by name/email, status filter (All/Active/Suspended), plan filter, CSV export of filtered list, full user table with suspend/unban + manual plan upgrade
- [x] **Pricing Manager:** List all plans, create/edit (name, slug, price, duration, features), toggle active, delete
- [x] **Category Manager:** List all categories, create/edit (name, emoji, sort order), toggle active, delete
- [x] **Global Settings:** Announcement banner text + enable toggle, allow-registrations toggle
- [x] **Activity Logs:** Read-only chronological log of all admin actions (suspend, unban, upgrade); auto-refreshes every 30s

### CMS / Dynamic Configuration
- [x] `categories` table — admin-managed, drives expense form dropdown + monthly summary zero-fill
- [x] `pricing_plans` table — admin-managed, drives `/pricing` page and subscription upgrade
- [x] `system_settings` table (single row) — announcement banner + registration gate

### Landing Page
- [x] Public hero with CTA card (Sign In → `/sign-in`, Create free account → `/sign-up`)
- [x] Mini dashboard preview in CTA card
- [x] Feature cards, animated slideshow, "How It Works" section
- [x] Signed-in users auto-redirected to `/dashboard` (handled by `HomeRedirect` in App.tsx)

---

## Known Issues

- **Admin sign-in via Clerk:** The seeded admin (`admin@expanse.app`) needs to sign up via Clerk with the same email. The JIT provisioner will match by email and link the existing admin row (with `role = 'admin'`) to the new Clerk identity.
- **Category deletion is not guarded:** Deleting a category does not prevent existing expenses from referencing it. Those expenses still display correctly (free-text field) but won't appear in filter bar.
- **No pagination on expense list:** Dashboard shows only the 8 most recent expenses for the selected month. Older entries are in totals and PDF export.
- **Mobile layout not fully tested:** Sidebar is hidden on mobile with no hamburger/bottom-tab navigation.

---

## Next Steps (What We Are Building Next)

### High Priority
- [ ] **Mobile app** (Task #2 — currently merging): React Native / Expo companion app; will need Clerk Expo SDK integration (`@clerk/expo`).
- [ ] **Expense history beyond current month** (Task #4): Persistent history view with pagination across all months.

### Medium Priority
- [ ] **Edit expense after logging** (Task #5 — proposed): Already works on web.
- [ ] **Native date picker** (Task #6 — proposed): Replace text date input with native picker.
- [ ] **In-dashboard subscription badge:** Show plan + expiry in sidebar footer with "Upgrade" CTA for free users.
- [ ] **Mobile sidebar / hamburger menu:** Bottom-tab navigation or slide-out drawer for mobile.

### Low Priority / Future
- [ ] **Expense notes field:** Optional free-text note per expense (not yet in schema).
- [ ] **Category icon picker:** Visual emoji picker instead of free-text input in Category Manager.
- [ ] **Admin role promotion UI:** Grant/revoke admin roles from the Users tab.
- [ ] **Receipt email on subscription:** Transactional email when a user subscribes.
