# MovieMatcher v2

Tinder-like group movie matching app built with React, Supabase Realtime, and Netlify Functions.

## Stack

- `apps/web`: React + TypeScript + Vite + Tailwind + Zustand + React Query
- `apps/functions`: Netlify Functions (TMDB proxy + server actions)
- `supabase/migrations`: PostgreSQL schema + RLS policies
- `tests/e2e`: Playwright end-to-end tests

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Required environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `TMDB_API_KEY`

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
- Initial app shell + room entry UI created
- Unit + E2E smoke tests passing
