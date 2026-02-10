# MovieMatcher v2

Tinder-like group movie matching app built with React, Supabase Realtime, and Netlify Functions.

## Stack

- `apps/web`: React + TypeScript + Vite + Tailwind + Zustand + React Query + dnd-kit
- `apps/functions`: Netlify Functions (TMDB proxy + server actions)
- `supabase/migrations`: PostgreSQL schema + RLS policies
- `tests/e2e`: Playwright end-to-end tests

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Use `npx netlify dev` when testing Netlify Functions locally (`create-room`, `join-room`).

Required environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only for Netlify Functions)
- `TMDB_API_KEY` (required for `start-room` candidate seeding)

## Commands

```bash
npm run dev          # Start web app
npm run build        # Build web app
npm run test         # Unit tests (Vitest)
npm run test:e2e     # E2E tests (Playwright)
```

## Current milestone

- Workspace scaffold is ready
- Baseline Supabase schema created
- Anonymous auth + room create/join/start server actions wired
- `start-room` now seeds initial movie candidates from TMDB based on room preferences
- Live lobby sync from Supabase Realtime subscriptions
- Active voting screen: candidates load in-room and votes persist per user
- Unit + E2E smoke tests passing

If lobby sync fails after applying schema manually, run all migrations in order. The `20260209233600_rls_grants_fix.sql` migration updates RLS policies and grants needed for lobby reads.
