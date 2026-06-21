# MovieMatcher v2 — AGENTS.md

## Overview

Multi-user movie matching app. Host creates room, invites friends. Users select genre preferences + streaming providers. App fetches candidate movies from TMDB. Users swipe (like/dislike/skip) through a personalized queue. Social signals propagate in realtime. When 3+ "obvious winners" emerge, room transitions to secret final vote. Winner determined by majority (tie-break via SHA256 deterministic random).

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Mantine v7 + Zustand (persisted) + React Query v5 + dnd-kit + Framer Motion + Supabase (Postgres + Realtime + Auth) + Netlify Functions + TMDB API

---

## Directory Structure

```
moviematcherv2/
├── apps/
│   ├── web/                          # React SPA frontend
│   │   └── src/
│   │       ├── main.tsx              # Entry: QueryClient + Mantine + App
│   │       ├── App.tsx               # Root state machine (lobby|active|final_voting|finished)
│   │       ├── index.css             # Tailwind import + CSS vars
│   │       ├── store/useSessionStore.ts  # Zustand: nickname, userId, roomId, roomCode, role
│   │       ├── lib/
│   │       │   ├── api.ts            # Generic postFunction + all Netlify function callers
│   │       │   ├── supabase.ts       # Supabase client (anon key)
│   │       │   ├── session.ts        # ensureAnonymousSession()
│   │       │   ├── devSession.ts     # dev_session URL param scoping for multi-user testing
│   │       │   ├── room.ts           # fetchRoomSnapshot, subscribeToRoomChanges (Realtime)
│   │       │   ├── voting.ts         # fetchRoomVotingSnapshot, submitVote, subscribeToVotingChanges
│   │       │   ├── finalVote.ts      # fetchRoomFinalVoteSnapshot, submitRoomFinalVote, subscribe
│   │       │   └── results.ts        # fetchRoomResults (Supabase direct query)
│   │       ├── constants/setup.ts    # GENRE_OPTIONS (17 genres), PROVIDER_OPTIONS (7), STEP_COPY
│   │       ├── utils/movie.ts        # releaseYear()
│   │       └── components/
│   │           ├── onboarding/
│   │           │   ├── LandingView.tsx      # "Create/Join" → nickname → room code (3 mini-steps)
│   │           │   ├── RoomOnboarding.tsx   # Orchestrator: mutation calls + step state
│   │           │   └── SetupFlow.tsx        # Multi-step genre/provider wizard (themed)
│   │           ├── lobby/LobbyView.tsx      # Room code badge, member list, start/leave buttons
│   │           ├── active-room/
│   │           │   ├── ActiveRoomContainer.tsx  # 🔥 Main voting controller (useReducer queue, dnd, optimistic)
│   │           │   ├── ActiveRoomContext.ts     # React context type definitions
│   │           │   ├── ActiveRoomProvider.tsx   # Context provider wrapper
│   │           │   ├── ActiveRoomView.tsx       # Layout: topbar → card panel → action bar
│   │           │   ├── ActiveRoomTopBar.tsx     # History/Menu buttons + progress counter
│   │           │   ├── ActiveRoomMoviePanel.tsx # DndContext + SwipeMovieCard + NextMovieCard
│   │           │   ├── ActiveRoomActionBar.tsx  # Dislike, Info, Like, Skip buttons
│   │           │   ├── ActiveRoomOverlays.tsx   # HistoryDrawer + RoomMenuDrawer + MovieInfoModal
│   │           │   ├── SwipeMovieCard.tsx       # Draggable card with exit animation + badges
│   │           │   ├── NextMovieCard.tsx        # Card behind current, revealed proportionally
│   │           │   ├── MovieInfoModal.tsx       # TMDB details: overview, runtime, YouTube trailers
│   │           │   ├── HistoryDrawer.tsx        # Side drawer: grid of swiped poster thumbnails
│   │           │   ├── RoomMenuDrawer.tsx       # Side drawer: leave room
│   │           │   ├── queue.ts                # CandidateQueue reducer + reconcile/inject logic
│   │           │   └── recommendation.ts       # Client-side ranking: genre + social + taste scoring
│   │           ├── final-voting/
│   │           │   ├── FinalVotingContainer.tsx # Polls final-vote-snapshot, submits vote
│   │           │   └── FinalVotingView.tsx      # Top 3 contender cards, secret ballot UI
│   │           └── results/
│   │               ├── RoomResults.tsx          # Wrapper: queries fetchRoomResults
│   │               └── ResultsView.tsx          # Hero reveal → details: winner, runner-ups, wheel
│   └── functions/                    # Netlify Functions (serverless backend)
│       └── src/
│           ├── _lib/
│           │   ├── http.ts           # CORS, JSON responses, Bearer token extraction
│           │   ├── supabase.ts       # getServiceClient (service_role), getUserFromToken
│           │   ├── tmdb.ts           # discoverMovies, resolveProviderIds, fetchMovieDetails
│           │   └── room-scoring.ts   # evaluateRanking, evaluateAndFinalizeRoom, contender qualification
│           ├── ping.ts               # Health check
│           ├── create-room.ts        # Create + join host to room (6-char code, 10 retries)
│           ├── join-room.ts          # Join by room code
│           ├── start-room.ts         # Aggregate prefs → TMDB discover → insert 30 candidates
│           ├── submit-decision.ts    # Upsert vote → evaluateAndFinalizeRoom
│           ├── voting-snapshot.ts    # Return candidates + userVotes + aggregates + preferences
│           ├── final-vote-snapshot.ts # Return contenders + vote counts + own vote
│           ├── submit-final-vote.ts  # Secret vote → when all in: count, tie-break, finish room
│           └── movie-details.ts      # TMDB movie details + YouTube trailers
├── packages/shared/src/index.ts      # All TypeScript types/interfaces (204 lines)
├── supabase/migrations/              # 5 SQL migration files
├── tests/e2e/                        # Playwright E2E + multi-user simulator
├── docs/recommendation-and-room-flow-ideas.md  # Product spec + implementation backlog
├── netlify.toml                      # Build config: publish=apps/web/dist, functions=apps/functions/src
└── playwright.config.ts              # Chromium, web server auto-start, multi-user sim env flag
```

---

## Database Schema (Supabase Postgres)

### Tables

| Table | Columns | Purpose |
|---|---|---|
| `rooms` | `id (uuid PK)`, `code (text unique)`, `host_user_id`, `status (lobby\|active\|final_voting\|finished)`, `created_at`, `started_at`, `ended_at` | Room lifecycle |
| `room_members` | `room_id+user_id (PK)`, `nickname`, `connected (bool)`, `joined_at`, `last_seen_at` | Room participants |
| `room_preferences` | `room_id+user_id (PK, FK→room_members)`, `liked_genres (int[])`, `disliked_genres (int[])`, `providers (text[])` | User genre/provider picks |
| `movie_candidates` | `room_id+tmdb_id (PK)`, `metadata_snapshot (jsonb)`, `round_index`, `created_at` | TMDB movies fetched for room |
| `votes` | `room_id+user_id+tmdb_id (PK)`, `vote (like\|dislike\|skip)`, `weight (numeric)`, `decided_at` | Active swipe decisions |
| `room_final_contenders` | `room_id+tmdb_id (PK)`, `rank (1-3)`, `score_breakdown (jsonb)`, `qualification_reason`, UNIQUE(room_id,rank) | Top 3 for final vote |
| `room_result_votes` | `room_id+user_id (PK)`, `tmdb_id`, `created_at`, `updated_at` | Secret ballot votes (one per user) |
| `room_final_choices` | `room_id (PK)`, `tmdb_id`, `resolution_method (secret_vote\|wheel)`, `tie_break_used`, `tie_break_candidates`, `tie_break_seed`, `vote_counts (jsonb)`, `resolved_by`, `resolved_at` | Final winner record |
| `room_events` | `id (bigint auto PK)`, `room_id`, `type (text)`, `payload (jsonb)`, `seq (bigint, UNIQUE per room)`, `created_at` | Audit log |
| `room_results` | `room_id+tmdb_id (PK)`, `score_breakdown (jsonb)`, `decided_at` | Score snapshots for top 3 |

### RLS
- All tables RLS-enabled
- `public.is_room_member(uuid)` SECURITY DEFINER function gates reads
- `anon` + `authenticated` roles granted select/insert/update per policy
- `room_result_votes` readable only when room `finished`; writable only during `final_voting`
- Functions use service_role client (bypasses RLS)

---

## Room Lifecycle State Machine

```
lobby → active → final_voting → finished
```

### 1. Lobby
- Host creates room (6-char code, ambiguous chars excluded: `0OI1L`)
- Joiners enter room code + nickname
- All users complete 2-3 step preference wizard (liked genres, disliked genres, providers for host)

### 2. Active (Swiping)
- Host clicks "Start room" → `start-room` function
- Aggregates all member preferences: top 5 liked genres (by count), disliked genres with >=50% agreement
- Calls TMDB `/discover/movie` with genre filters, host's providers, US region, 3 pages, min 50 votes
- Inserts top 30 movies as candidates (ordered by TMDB popularity)
- Each user swipes through personalized queue (`rankCandidatesForUser`)

### 3. Final Voting (Secret Ballot)
- Triggered when 3+ "obvious winners" qualify (see scoring below)
- `evaluateAndFinalizeRoom` called after every vote submission
- Top 3 contenders frozen into `room_final_contenders`
- Each user submits one secret vote via `room_result_votes`
- Votes hidden until all members voted

### 4. Finished
- When all votes in: counted, winner declared
- Tie: SHA256(roomId:UUID:candidates_csv) → hex prefix mod count for deterministic random
- `room_final_choices` row created, room status → `finished`
- Results view shows winner + runner-ups + score breakdowns

---

## Scoring & Recommendation Logic

### Server-Side Ranking (`apps/functions/src/_lib/room-scoring.ts`)

Formula per movie:
```
score = likes*1.0 + dislikes*(-0.9) + skips*(-0.15)     // baseScore
      + likeRatio*1.65 + dislikeRatio*(-1.1) + skipRatio*(-0.3)  // ratio weights
      + normalizedTmdbQuality*0.35                       // TMDB vote avg / 10
      + decisionCoverage*0.2                             // % members who voted
      + consensusBonus (1.4 if likes >= 72% of members)
      + unanimousBonus (2.2 if all members liked)
```

Sorted by score desc, then likes desc, then dislikes asc, then roundIndex asc.

### Contender Qualification (`evaluateAndFinalizeRoom`)
- **Obvious winner:** decisionCoverage >= 80% AND (likeRatio == 1.0 OR likeRatio >= 0.8)
- **Transition to final_voting:** when 3+ obvious winners exist, OR all candidates decided with >=3 total
- On transition: upserts `room_results` (top 3), clears + upserts `room_final_contenders`, clears old `room_result_votes` + `room_final_choices`, sets room status → `final_voting`

### Client-Side Ranking (`apps/web/src/components/active-room/recommendation.ts`)

Per-user queue ordering (undecided candidates only):
```
score = preferredGenreMatches*1.8
      + learnedGenreMatches*0.95       // genres from movies user already liked
      - blockedGenreMatches*2.25
      + socialLikeBoost (5 + likes*1.6) // aggregate likes from all users
      - socialDislikePenalty (dislikes*1.05)
      - socialSkipPenalty (skips*0.28)
      + voteAverage*0.05
      + (1000 - roundIndex)*0.0001      // slight recency bias
```

### Queue Management (`queue.ts`)
- `useReducer` with actions: `reset`, `reconcile`, `inject_likes`, `remove`, `prepend`
- Reconcile: keeps existing queue order for items still in ranked set, appends new ones, removes dead ones
- Social injection: when another user increases likes for a movie, injects at position 1-3 (deterministic: `1 + ((tmdbId + likes) % 3)`) if not already in queue
- Current card never replaced mid-display
- Optimistic: removed on swipe, prepended back on network failure

---

## API Endpoints (Netlify Functions)

All POST, all require `Authorization: Bearer <supabase_access_token>`.

| Endpoint | Input | Output | Side Effects |
|---|---|---|---|
| `/.netlify/functions/ping` | `{}` | `{ok, service}` | None |
| `create-room` | `{nickname, preferredGenres, blockedGenres, providers}` | `{roomId, roomCode, userId, role:"host"}` | Inserts room, member, preferences |
| `join-room` | `{roomCode, nickname, preferredGenres, blockedGenres}` | `{roomId, roomCode, userId, role}` | Upserts member + preferences |
| `start-room` | `{roomId}` | `{roomId, status, startedAt, candidateCount}` | TMDB discover → insert candidates, update room status |
| `voting-snapshot` | `{roomId}` | `{candidates, userVotes, aggregates, preferenceProfile}` | Read-only |
| `submit-decision` | `{roomId, tmdbId, vote}` | `{roomId, status, finished, winnerTmdbId}` | Upserts vote → evaluateAndFinalizeRoom |
| `movie-details` | `{tmdbId}` | `{tmdbId, title, overview, releaseDate, runtime, trailers}` | TMDB API call |
| `final-vote-snapshot` | `{roomId}` | `{roomId, status, contenders, totalVoters, votesSubmitted, hasVoted, selectedTmdbId, votingComplete, winnerTmdbId}` | Read-only |
| `submit-final-vote` | `{roomId, tmdbId}` | `{roomId, status, finished, votesSubmitted, totalVoters, winnerTmdbId}` | Upserts vote → count/tie-break/finish room |

---

## Component Architecture

### App.tsx — Root state machine
Routes based on `roomSnapshot.status`:
- `null` → `<RoomOnboarding>` + `<LobbyView>`
- `"lobby"` → `<LobbyView>`
- `"active"` → `<ActiveRoomContainer>`
- `"final_voting"` → `<FinalVotingContainer>`
- `"finished"` → `<RoomResults>`

Polls `fetchRoomSnapshot` every 2s. Subscribes to Supabase Realtime (rooms + room_members).

### ActiveRoomContainer — Voting controller
- `useReducer(candidateQueueReducer, [])` for queue
- `useQuery` polls `voting-snapshot` every 2s
- Subscribes to `movie_candidates` + `votes` Realtime changes
- Computes: `reactionByMovie` (optimistic + server), `rankedRemainingCandidates`, `historyItems`
- `useEffect` reconciling queue with ranked candidates + social injection
- `triggerCardSwipe`: sets `cardExit` → 320ms timeout → `commitMovieDecision`
- Preloads next 5 poster images

### Data Flow Summary
```
User action → optimistic update (Zustand/local state)
           → React Query mutation (POST to Netlify Function)
           → Function writes to Supabase (service_role)
           → Supabase Realtime broadcasts change
           → Other clients' subscriptions fire → invalidate React Query → re-poll
```

---

## State Management

### Zustand (`useSessionStore.ts`)
Persisted to localStorage (key scoped by `dev_session` param):
- `nickname`, `userId`, `roomId`, `roomCode`, `role`

### React Query
- `["room", roomId]` — room snapshot (poll 2s)
- `["voting", roomId, userId]` — voting snapshot (poll 2s)
- `["movie-details", tmdbId]` — lazy, on info modal open
- `["final-vote", roomId, userId]` — final vote snapshot (poll 2s)
- Mutations: `createRoom`, `joinRoom`, `startRoom`, `submitDecision`, `submitFinalVote`

### Local State (ActiveRoom)
- `candidateQueue` (useReducer)
- `optimisticDecisions` (Record<number, SwipeDecision>)
- `dragOffset`, `cardExit` (animation state)
- `showHistory`, `showMenu`, `showInfo` (drawer/modal visibility)

---

## Authentication

- **Supabase Anonymous Auth**: `signInAnonymously()` on app mount, no user-facing login
- Access token sent as Bearer header to all Netlify Functions
- Functions validate via `getUserFromToken(token)` using service role key
- RLS policies gate all table access
- **Dev isolation**: `?dev_session=xxx` URL param scopes localStorage + Supabase auth storage key, enabling multiple browser contexts to act as different users

---

## TMDB Integration (`apps/functions/src/_lib/tmdb.ts`)

- `discoverMovies(filters)`: `/discover/movie` — `with_genres`, `without_genres`, `with_watch_providers`, `watch_region=US`, `sort_by=popularity.desc`, `vote_count.gte=50`, up to 5 pages, deduplicated by ID
- `resolveProviderIds(names, region)`: `/watch/providers/movie` — fuzzy name matching
- `fetchMovieDetails(tmdbId)`: `/movie/{id}` + `append_to_response=videos` — YouTube trailers only
- Poster URL: `https://image.tmdb.org/t/p/w500{path}`

---

## Commands

```bash
npm run dev               # Vite dev server (frontend only)
npm run dev:netlify       # Vite + Netlify Functions locally (port 8888)
npm run build             # Production build (tsc + vite)
npm run test              # Vitest unit tests
npm run typecheck:functions  # TypeScript check on functions
npm run test:e2e          # Playwright E2E tests
npm run test:e2e:ui       # Playwright with UI mode
npm run simulate:room     # Multi-user simulator (RUN_MULTI_USER_SIM=1)
```

---

## Environment Variables

```
VITE_SUPABASE_URL=              # Supabase project URL (client bundle)
VITE_SUPABASE_ANON_KEY=         # Supabase anon key (client bundle)
SUPABASE_URL=                   # Same URL (server-side functions)
SUPABASE_SERVICE_ROLE_KEY=      # Service role key (server-only, bypasses RLS)
TMDB_API_KEY=                   # TMDB API key for movie discovery
```

Optional test flags: `RUN_MULTI_USER_SIM=1`, `SIM_USER_COUNT=3`, `SIM_DECISIONS=6`

---

## Testing

### Unit Tests (Vitest)
- `App.test.tsx`: smoke test rendering
- `devSession.test.ts`: dev session scope utilities
- `queue.test.ts`: reconcile, inject, deduplication

### E2E Tests (Playwright)
- `smoke.spec.ts`: basic page load
- `multi-user-simulator.spec.ts`: creates N browser contexts with `dev_session=N`, host creates room, joiners join, all vote through multiple decision rounds, handles state transitions to final_voting/results

---

## Key Patterns

- **No page router** — App.tsx is a state machine switching on `roomSnapshot.status`
- **Optimistic updates**: vote applied locally, confirmed by server; on failure, reverts and prepends movie back
- **Polling + Realtime**: React Query 2s polling + Supabase Realtime subscriptions invalidating queries
- **Service role for functions**: bypasses RLS, auth via Bearer token validation only
- **useReducer + reference equality**: queue reducer returns same array reference when unchanged to avoid re-renders
- **Reference equality optimization**: `arraysEqual` in queue.ts, `useMemo` throughout
- **Mutual exclusion**: genre can't be both liked AND blocked
- **Room code generation**: 6-char alphanumeric, excludes ambiguous chars `0OI1L`, up to 10 retries on collision
- **Tie-break**: `SHA256(roomId:randomUUID:candidatesCSV)` hex prefix modulo candidate count
- **All shared types** in `packages/shared/src/index.ts` — single source of truth
