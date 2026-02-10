# MovieMatcher Recommendation And Room Flow Ideas

## Document Purpose
Keep product and engineering decisions for recommendation flow, room progression, and session finalization in one place. This is the working spec for future iterations.

## Product Goals
1. Find a group-compatible movie quickly.
2. Keep discovery fun and personalized.
3. Prevent janky UI transitions during live multi-user voting.
4. Keep the architecture simple enough for a small team and low-to-medium room traffic.

## Core Experience Principles
1. Users should rarely lose context of the movie currently on screen.
2. Social influence should be strong but not disruptive.
3. Every user should feel they have agency, not that the app is auto-picking too early.
4. Final result should feel fair and explainable.

## Recommendation Model
### Base ranking signals
1. Preferred genre overlap.
2. Blocked genre penalty.
3. Social signal from group likes/dislikes/skips.
4. Session taste learning from movies the user already liked.
5. Lightweight TMDB quality prior.

### Queue-first delivery model
1. Maintain a local per-user queue of candidate `tmdbId`s.
2. Do not replace the currently visible card during realtime updates.
3. Reconcile queue with latest ranked candidates while preserving local continuity.
4. Remove a movie from local queue immediately after the local user votes.
5. Reinsert on network failure for resilience.

### Social propagation rule
1. When another user increases likes for a movie, inject that movie into each undecided user queue.
2. Insert at position `1-3` after current card, never at position `0`.
3. Do not duplicate if movie already exists in queue.
4. Keep insertion deterministic for testability, but allow later migration to seeded randomness.

### Prefetch behavior
1. Keep next card rendered under current card.
2. Preload poster images for next `5` queued movies.
3. Reveal next card gradually while dragging current card.

## Current Implementation Snapshot
### Implemented
1. Voting supports `like`, `dislike`, `skip`.
2. Server-side room scoring and finish transition.
3. Results view with top picks and wheel UI.
4. Voting snapshot endpoint returns candidates, user votes, aggregates, and preference profile.
5. Client-side personalized ranking logic.
6. Queue-based card delivery that prevents immediate cross-user card replacement.
7. Social like injection into upcoming queue positions.
8. Multi-card preloading to smooth card transitions.

### Implemented but local-only
1. Wheel winner is local UI state and not persisted.

### Not implemented yet
1. Final showdown candidate qualification logic:
2. Require at least `3` obvious winners before session can close.
3. Persisted secret-ballot flow for final movie selection.
4. Persisted wheel-spin final decision event.
5. Explanation chips backed by explicit scoring factors.
6. Extended taste signals, including franchise/actor/director affinity.

## Room Stop And Result Logic
### Current behavior
1. Server computes weighted scores from likes/dislikes/skips and consensus metrics.
2. Room finishes when winner is mathematically clear or all candidates are decided.
3. Results include top-ranked candidates and score breakdown.

### Planned refinements
1. Introduce contender qualification rule for "obvious winners":
2. A movie becomes a contender when either:
3. `likeRatio === 1.0` (everyone liked), or
4. `likeRatio >= 0.8` (at least 80% liked).
5. Session continues until at least `3` contenders are qualified.
6. Add minimum decision coverage threshold before a movie can qualify.
7. Add optional minimum elapsed session time before room can finish.
8. Add room configuration for strict vs fast-stop mode.

## End-of-Session Decision Flow
### Desired flow
1. Show exactly top `3` contenders with transparent scores.
2. Option A (default): start secret final vote where each user selects one contender.
3. Final vote results stay hidden until every connected member has voted.
4. If one movie has highest votes, it becomes final winner.
5. If there is a tie for highest votes, select randomly among tied movies.
6. Option B: host can choose wheel flow and spin among top 3.
7. Persist final chosen movie and lock room state.
8. Broadcast final choice event to all members.

### Proposed schema additions
1. `room_final_contenders` table:
2. Stores the 3 qualified contenders for the showdown with snapshot scores.
3. `room_result_votes` table:
4. One hidden vote per user for one contender (`UNIQUE(room_id, user_id)`).
5. `room_final_choices` table:
6. Final winner, resolution mode (`secret_vote` or `wheel`), tie-break metadata.
7. `room_events` entries for:
8. `final_contenders_locked`, `final_vote_started`, `final_vote_closed`, `final_tie_randomized`, `wheel_spun`, `final_choice_locked`.

### Final showdown algorithm draft
1. During active voting, continuously evaluate contender qualification.
2. Once at least 3 contenders exist, freeze active swiping and transition room to `final_voting`.
3. Compute final 3 contenders by overall score ordering.
4. Open secret vote and accept one vote from each connected room member.
5. When all required votes are in, resolve winner:
6. Highest vote count wins.
7. If tie, randomly choose among tied leaders and store RNG seed/value for auditability.
8. Transition room to `finished` and publish final result event.

## Analytics And Retention Proposal
### Why store data
1. Tune weights and stop conditions.
2. Measure satisfaction and session quality.
3. Learn which recommendation features actually improve convergence.

### Proposed retention policy
1. Raw per-vote and per-event data: keep `30 days`.
2. Aggregated room metrics: keep `180 days`.
3. Daily anonymized summary tables: keep indefinitely.
4. Add scheduled cleanup job and document retention in privacy policy.

## Developer Testing And Simulation
### Two-layer simulator strategy
1. Use URL-scoped `dev_session` to isolate local browser identity/storage.
2. Use Playwright multi-context test to run host + members concurrently.
3. Validate room join sync, start sync, vote sync, queue continuity, and finish transition.

### High-value simulator scenarios
1. Two users like/dislike conflicting movies and ensure no forced current-card replacement.
2. One user likes movie `X` and verify `X` appears within next `1-3` cards for others.
3. Reconnect one user mid-session and verify queue recovers without data loss.
4. Simulate ties and verify deterministic top-3 ordering.

## Configurable Knobs To Externalize
1. Ranking weights for genre/social/taste signals.
2. Social injection strength and insertion window size.
3. Queue preload depth.
4. Stop thresholds and minimum coverage requirements.
5. Wheel availability and host-only permissions.

## Prioritized Implementation Backlog
### P0
1. Implement contender qualification (`100%` or `>=80%` likes) and 3-contender gate.
2. Add `final_voting` room state and UI transition.
3. Implement persisted secret final vote (hidden until all voted).
4. Implement deterministic tie-randomization with persisted audit metadata.
5. Broadcast final decision consistently to all clients.
6. Add simulator coverage for:
7. queue injection and no-card-replacement invariant,
8. contender qualification and final-vote completion,
9. tie-case random resolution.

### P1
1. Add room-level scoring profile presets.
2. Add result explainability chips from score breakdown.
3. Add configurable stop thresholds in room settings.

### P2
1. Add advanced preference features.
2. Add long-term aggregated analytics dashboards.
3. Add optional recommendation diversity controls.

## Open Questions
1. Should disconnected members count toward required final-vote quorum, or only currently connected members?
2. Should wheel be always available to host, or only before final vote starts?
3. Do we want deterministic social insertion for all users or per-user seeded randomness?
4. Should queue state remain client-only or partially persisted for reconnect continuity?
