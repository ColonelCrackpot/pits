-- PIT LEGENDS leaderboard — run in the Supabase SQL editor (project ucoupqzhsfiefnjfqkmh).
-- Migration v2 (July 2026): SCORE becomes the ranking stat; best time is secondary.
alter table public.pits_scores add column if not exists score double precision not null default 0;

drop function if exists public.pits_submit_score(text, text, double precision);

create or replace function public.pits_submit_score(
  p_id text, p_name text, p_secs double precision, p_score double precision
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  -- MUST match SB.maxSecs / SB.maxScore in js/config.js
  max_secs constant double precision := 86400;
  max_score constant double precision := 1000000000;
  clean_name text := left(coalesce(nullif(btrim(p_name), ''), 'Anonymous'), 16);
begin
  if p_id is null or length(p_id) < 8
     or p_secs is null or not (p_secs >= 0 and p_secs <= max_secs)
     or p_score is null or not (p_score >= 0 and p_score <= max_score) then
    return;
  end if;
  insert into public.pits_scores (player_id, name, secs, score, updated_at)
  values (p_id, clean_name, p_secs, p_score, now())
  on conflict (player_id) do update set
    name       = excluded.name,
    secs       = greatest(public.pits_scores.secs, excluded.secs),   -- stats only go up
    score      = greatest(public.pits_scores.score, excluded.score),
    updated_at = now();
end;
$$;

grant execute on function public.pits_submit_score(text, text, double precision, double precision) to anon, authenticated;

-- compat shim (already applied): the pre-score live client calls the 3-arg
-- version; forward with score 0. Safe to drop once every client is updated.
create or replace function public.pits_submit_score(p_id text, p_name text, p_secs double precision)
returns void language sql security definer set search_path = public as $$
  select public.pits_submit_score(p_id, p_name, p_secs, 0);
$$;
grant execute on function public.pits_submit_score(text, text, double precision) to anon, authenticated;
