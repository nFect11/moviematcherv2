create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = target_room_id
      and rm.user_id = auth.uid()
  );
$$;

grant execute on function public.is_room_member(uuid) to anon, authenticated;

drop policy if exists "room members can read own room" on public.rooms;
drop policy if exists "member can read members in own room" on public.room_members;
drop policy if exists "member can insert self membership" on public.room_members;
drop policy if exists "member manages own preferences" on public.room_preferences;
drop policy if exists "member can read candidates" on public.movie_candidates;
drop policy if exists "member manages own votes" on public.votes;
drop policy if exists "member can read room events" on public.room_events;
drop policy if exists "member can read results" on public.room_results;

create policy "room members can read own room"
  on public.rooms for select
  using (public.is_room_member(id));

create policy "member can read members in own room"
  on public.room_members for select
  using (public.is_room_member(room_id));

create policy "member can insert self membership"
  on public.room_members for insert
  with check (user_id = auth.uid());

create policy "member can update self membership"
  on public.room_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "member manages own preferences"
  on public.room_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "member can read candidates"
  on public.movie_candidates for select
  using (public.is_room_member(room_id));

create policy "member manages own votes"
  on public.votes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "member can read room events"
  on public.room_events for select
  using (public.is_room_member(room_id));

create policy "member can read results"
  on public.room_results for select
  using (public.is_room_member(room_id));

grant usage on schema public to anon, authenticated;
grant select on public.rooms to anon, authenticated;
grant select, insert, update on public.room_members to anon, authenticated;
grant select, insert, update on public.room_preferences to anon, authenticated;
grant select on public.movie_candidates to anon, authenticated;
grant select, insert, update on public.votes to anon, authenticated;
grant select on public.room_events to anon, authenticated;
grant select on public.room_results to anon, authenticated;
