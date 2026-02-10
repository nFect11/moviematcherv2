alter table public.rooms drop constraint if exists rooms_status_check;

alter table public.rooms
  add constraint rooms_status_check
  check (status in ('lobby', 'active', 'final_voting', 'finished'));

create table if not exists public.room_final_contenders (
  room_id uuid not null references public.rooms(id) on delete cascade,
  tmdb_id int not null,
  rank int not null check (rank between 1 and 3),
  score_breakdown jsonb not null,
  qualification_reason text not null default 'obvious_winner',
  created_at timestamptz not null default now(),
  primary key (room_id, tmdb_id),
  unique (room_id, rank),
  foreign key (room_id, tmdb_id) references public.movie_candidates(room_id, tmdb_id) on delete cascade
);

create table if not exists public.room_result_votes (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,
  tmdb_id int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id),
  foreign key (room_id, user_id) references public.room_members(room_id, user_id) on delete cascade,
  foreign key (room_id, tmdb_id) references public.room_final_contenders(room_id, tmdb_id) on delete cascade
);

create table if not exists public.room_final_choices (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  tmdb_id int not null,
  resolution_method text not null check (resolution_method in ('secret_vote', 'wheel')),
  tie_break_used boolean not null default false,
  tie_break_candidates int[] not null default '{}',
  tie_break_seed text,
  vote_counts jsonb not null default '{}'::jsonb,
  resolved_by uuid,
  resolved_at timestamptz not null default now(),
  foreign key (room_id, tmdb_id) references public.room_final_contenders(room_id, tmdb_id) on delete cascade
);

alter table public.room_final_contenders enable row level security;
alter table public.room_result_votes enable row level security;
alter table public.room_final_choices enable row level security;

drop policy if exists "member can read final contenders" on public.room_final_contenders;
drop policy if exists "member manages own final vote" on public.room_result_votes;
drop policy if exists "member can read final choices" on public.room_final_choices;

create policy "member can read final contenders"
  on public.room_final_contenders for select
  using (public.is_room_member(room_id));

create policy "member manages own final vote"
  on public.room_result_votes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "member can read final choices"
  on public.room_final_choices for select
  using (public.is_room_member(room_id));

grant select on public.room_final_contenders to anon, authenticated;
grant select, insert, update on public.room_result_votes to anon, authenticated;
grant select on public.room_final_choices to anon, authenticated;
