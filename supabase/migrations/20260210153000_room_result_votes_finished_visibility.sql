drop policy if exists "member manages own final vote" on public.room_result_votes;
drop policy if exists "member can read final votes when finished" on public.room_result_votes;
drop policy if exists "member can insert own final vote during final voting" on public.room_result_votes;
drop policy if exists "member can update own final vote during final voting" on public.room_result_votes;

create policy "member can read final votes when finished"
  on public.room_result_votes for select
  using (
    public.is_room_member(room_id)
    and exists (
      select 1
      from public.rooms r
      where r.id = room_result_votes.room_id
        and r.status = 'finished'
    )
  );

create policy "member can insert own final vote during final voting"
  on public.room_result_votes for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.rooms r
      where r.id = room_result_votes.room_id
        and r.status = 'final_voting'
    )
  );

create policy "member can update own final vote during final voting"
  on public.room_result_votes for update
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.rooms r
      where r.id = room_result_votes.room_id
        and r.status = 'final_voting'
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.rooms r
      where r.id = room_result_votes.room_id
        and r.status = 'final_voting'
    )
  );
