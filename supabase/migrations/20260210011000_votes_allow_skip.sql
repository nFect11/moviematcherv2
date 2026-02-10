alter table public.votes drop constraint if exists votes_vote_check;

alter table public.votes
  add constraint votes_vote_check
  check (vote in ('like', 'dislike', 'skip'));
