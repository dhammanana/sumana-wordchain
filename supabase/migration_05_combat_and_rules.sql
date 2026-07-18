-- ============================================================
-- Migration 05: Combat mode, win/loss tracking, and host rules
-- ============================================================
-- Apply AFTER schema.sql (and migrations 02-04).
-- Adds:
--   * Win/loss counters on profiles and per-game results
--   * Host-configurable rules columns on groups
--   * Combat mode (gem wagers) support
--   * A end_game() RPC that records winners/losers and settles gems
-- ============================================================

-- 1. Win/loss tracking on profiles
alter table profiles
  add column if not exists games_won integer not null default 0,
  add column if not exists games_lost integer not null default 0;

-- 2. Host-configurable rules on groups
alter table groups
  add column if not exists win_score integer,               -- first to N points wins (null = no limit)
  add column if not exists dead_mode boolean not null default false, -- timeout = lose
  add column if not exists banned_vowels text not null default '',    -- comma-separated vowels e.g. 'a,e'
  add column if not exists min_length integer not null default 2,     -- minimum word length
  add column if not exists banned_suffixes text not null default '',  -- comma-separated e.g. 'ing'
  add column if not exists allowed_pos text not null default '',      -- comma-separated e.g. 'noun,verb'
  add column if not exists combat_mode boolean not null default false,-- gem wager mode
  add column if not exists gem_wager integer not null default 0;      -- gems wagered per game (combat)

-- 3. Per-game results (records winner/loser for each participant)
create table if not exists game_results (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  player_id uuid references profiles(id) on delete cascade,
  result text not null check (result in ('win', 'loss', 'draw')),
  gems_delta integer not null default 0,
  created_at timestamptz default now(),
  unique (group_id, player_id)
);

-- 4. Helper: parse a comma-separated text column into an array
create or replace function csv_to_array(input text)
returns text[]
language sql
immutable
as $$
  select case
    when input is null or trim(input) = '' then array[]::text[]
    else array_remove(array_agg(lower(trim(x))), '')
    end
  from unnest(string_to_array(input, ',')) as t(x);
$$;

-- 5. end_game(): mark group finished, record results, settle combat gems.
--    winner = highest score (or the player who reached win_score first).
--    In combat mode, the winner takes the wagered gems from each loser.
create or replace function end_game(group_id_param uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_group groups%rowtype;
  v_winner uuid;
  v_loser uuid;
  v_wager integer;
  v_participant record;
begin
  select * into v_group from groups where id = group_id_param for update;
  if not found then return; end if;
  if v_group.status = 'finished' then return; end if;

  -- Determine winner: highest score among members
  select player_id into v_winner
  from group_members
  where group_id = group_id_param
  order by score desc, turn_position asc
  limit 1;

  -- Mark group finished
  update groups set status = 'finished' where id = group_id_param;

  -- Record per-player results + update win/loss counters
  for v_participant in
    select player_id from group_members where group_id = group_id_param
  loop
    if v_participant.player_id = v_winner then
      insert into game_results (group_id, player_id, result, gems_delta)
        values (group_id_param, v_participant.player_id, 'win', 0)
        on conflict (group_id, player_id) do update set result = 'win';
      update profiles set games_won = games_won + 1 where id = v_participant.player_id;
    else
      insert into game_results (group_id, player_id, result, gems_delta)
        values (group_id_param, v_participant.player_id, 'loss', 0)
        on conflict (group_id, player_id) do update set result = 'loss';
      update profiles set games_lost = games_lost + 1 where id = v_participant.player_id;
    end if;
  end loop;

  -- Combat mode: winner collects wagered gems from each loser
  if v_group.combat_mode and v_group.gem_wager > 0 then
    v_wager := v_group.gem_wager;
    for v_loser in
      select player_id from group_members
      where group_id = group_id_param and player_id <> v_winner
    loop
      -- Loser pays (clamped at 0), winner receives
      update profiles set gems = greatest(gems - v_wager, 0) where id = v_loser;
      update profiles set gems = gems + v_wager where id = v_winner;
      update game_results set gems_delta = -v_wager
        where group_id = group_id_param and player_id = v_loser;
      update game_results set gems_delta = gems_delta + v_wager
        where group_id = group_id_param and player_id = v_winner;
    end loop;
  end if;
end;
$$;

-- 6. Dead mode helper: when a player times out in dead_mode, they lose the game
--    immediately and the game ends (combat: they forfeit wagered gems).
create or replace function dead_mode_eliminate(group_id_param uuid, player_id_param uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_group groups%rowtype;
begin
  select * into v_group from groups where id = group_id_param for update;
  if not found or v_group.status != 'active' then return; end if;

  -- Mark the eliminated player with a loss result immediately
  insert into game_results (group_id, player_id, result, gems_delta)
    values (group_id_param, player_id_param, 'loss', 0)
    on conflict (group_id, player_id) do update set result = 'loss';
  update profiles set games_lost = games_lost + 1 where id = player_id_param;

  -- End the game; remaining players split the win (winner = highest score)
  perform end_game(group_id_param);
end;
$$;

-- 7. RLS for game_results (participants can read their own)
alter table game_results enable row level security;
drop policy if exists "game_results_select" on game_results;
create policy "game_results_select" on game_results for select using (true);
