---
name: Clerk auth migration
description: Replit-managed Clerk replaced the custom JWT system; covers how session auth works, JIT provisioning, and key migration decisions.
---

## Rule
Expanse Tracker uses **Replit-managed Clerk** for authentication, not custom JWT.

## Session transport
- **Web:** Clerk session cookies; same-origin API calls send them automatically. Do NOT add `Authorization: Bearer`, `setAuthTokenGetter`, or `getToken()` to browser fetch calls — that is for Expo/mobile only.
- **Mobile (future):** Bearer token via `setAuthTokenGetter` + `@clerk/expo`.

## Backend
- `clerkMiddleware()` from `@clerk/express` is mounted in `app.ts` AFTER body parsers and AFTER the Clerk proxy (`CLERK_PROXY_PATH`).
- `requireAuth` middleware calls `getAuth(req)` to get the Clerk `userId`, then JIT-provisions a row in the local `users` table (matches existing JWT-era users by email first).
- `req.localUser` (type `typeof usersTable.$inferSelect`) is attached for all downstream handlers — use this instead of `req.user`.
- `requireAdmin` checks `req.localUser.role === 'admin'`.

## Frontend
- `useLocalUser()` hook (`hooks/use-local-user.tsx`) is the replacement for the old `useAuth()`. It combines Clerk's `isSignedIn` with a React Query fetch of `/api/user/profile` for local user data (role, subscriptionPlan, etc.).
- `ClerkProvider` is inside `<WouterRouter base={basePath}>` so that `useLocation()` works for `routerPush`/`routerReplace` callbacks.
- Sign-in/sign-up routes MUST be `path="/sign-in/*?"` and `path="/sign-up/*?"` — the `/*?` optional wildcard is required for Clerk's OAuth sub-paths.
- `publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)` from `@clerk/react/internal` — never the raw env var.
- `proxyUrl={import.meta.env.VITE_CLERK_PROXY_URL}` is unconditional (empty in dev, auto-set in prod).

## Schema
- `clerk_user_id TEXT UNIQUE` added to `users` table (nullable — legacy JWT users get it linked on first Clerk sign-in).
- `password_hash` is now nullable (Clerk users have no local password).

**Why:** Google OAuth and Email OTP required a real auth provider; Replit-managed Clerk was the right fit as it requires no external account setup and supports both methods out of the box.

**How to apply:** Any new auth-protected route → use `requireAuth` middleware → use `req.localUser.id` (not `req.user.userId`). Any frontend auth check → import from `@/hooks/use-local-user`, not `@/hooks/use-auth`.
