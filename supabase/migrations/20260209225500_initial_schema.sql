create extension if not exists "pgcrypto";

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_user_id uuid not null,
  status text not null check (status in ('lobby', 'active', 'finished')) default 'lobby',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,
  nickname text not null,
  connected boolean not null default true,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.room_preferences (
  room_id uuid not null,
  user_id uuid not null,
  liked_genres int[] not null default '{}',
  disliked_genres int[] not null default '{}',
  providers text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id),
  foreign key (room_id, user_id) references public.room_members(room_id, user_id) on delete cascade
);

create table if not exists public.movie_candidates (
  room_id uuid not null references public.rooms(id) on delete cascade,
  tmdb_id int not null,
  metadata_snapshot jsonb not null,
  round_index int not null,
  created_at timestamptz not null default now(),
  primary key (room_id, tmdb_id)
);

create table if not exists public.votes (
  room_id uuid not null,
  user_id uuid not null,
  tmdb_id int not null,
  vote text not null check (vote in ('like', 'dislike')),
  weight numeric(5,2) not null default 1.0,
  decided_at timestamptz not null default now(),
  primary key (room_id, user_id, tmdb_id),
  foreign key (room_id, user_id) references public.room_members(room_id, user_id) on delete cascade,
  foreign key (room_id, tmdb_id) references public.movie_candidates(room_id, tmdb_id) on delete cascade
);

create table if not exists public.room_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  seq bigint not null,
  created_at timestamptz not null default now(),
  unique (room_id, seq)
);

create table if not exists public.room_results (
  room_id uuid not null references public.rooms(id) on delete cascade,
  tmdb_id int not null,
  score_breakdown jsonb not null,
  decided_at timestamptz not null default now(),
  primary key (room_id, tmdb_id)
);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_preferences enable row level security;
alter table public.movie_candidates enable row level security;
alter table public.votes enable row level security;
alter table public.room_events enable row level security;
alter table public.room_results enable row level security;

create policy "room members can read own room"
  on public.rooms for select
  using (
    exists (
      select 1 from public.room_members m
      where m.room_id = rooms.id and m.user_id = auth.uid()
    )
  );

create policy "member can read members in own room"
  on public.room_members for select
  using (
    exists (
      select 1 from public.room_members m
      where m.room_id = room_members.room_id and m.user_id = auth.uid()
    )
  );

create policy "member can insert self membership"
  on public.room_members for insert
  with check (user_id = auth.uid());

create policy "member manages own preferences"
  on public.room_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "member can read candidates"
  on public.movie_candidates for select
  using (
    exists (
      select 1 from public.room_members m
      where m.room_id = movie_candidates.room_id and m.user_id = auth.uid()
    )
  );

create policy "member manages own votes"
  on public.votes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "member can read room events"
  on public.room_events for select
  using (
    exists (
      select 1 from public.room_members m
      where m.room_id = room_events.room_id and m.user_id = auth.uid()
    )
  );

create policy "member can read results"
  on public.room_results for select
  using (
    exists (
      select 1 from public.room_members m
      where m.room_id = room_results.room_id and m.user_id = auth.uid()
    )
  );
