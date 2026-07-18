-- ============================================================
-- WordChain Database Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- 1. PROFILES TABLE
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  email text,
  provider text,
  gems integer not null default 0,
  total_score integer not null default 0,
  total_days_active integer not null default 0,
  last_active_date date,
  created_at timestamptz default now()
);

-- Function to increment active day count (call once per day per user)
create or replace function track_user_activity(user_id_param uuid)
returns void
language plpgsql
security definer
as $$
begin
  update profiles
  set
    last_active_date = current_date,
    total_days_active = case
      when last_active_date is null or last_active_date < current_date then total_days_active + 1
      else total_days_active
    end
  where id = user_id_param;
end;
$$;

-- Function to add score and convert to gems (100 points = 1 gem)
create or replace function add_score_and_gems(user_id_param uuid, score_delta integer)
returns void
language plpgsql
security definer
as $$
begin
  update profiles
  set
    total_score = total_score + score_delta,
    gems = gems + floor(score_delta / 100)
  where id = user_id_param;
end;
$$;

-- Auto-create a profile row when a new auth user signs up (safety net)
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, email, provider)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'user_name', split_part(new.email, '@', 1), 'Player'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', null),
    new.email,
    coalesce(new.raw_app_meta_data->>'provider', (new.identities->0->>'provider'), 'email')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- 2. GROUPS TABLE
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  host_id uuid references profiles(id),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  turn_seconds int not null default 60,
  current_turn_player_id uuid references profiles(id),
  current_letter char(1),
  game_mode text not null default 'turns_timed' check (game_mode in ('turns_timed', 'turns_relaxed', 'free_for_all')),
  created_at timestamptz default now()
);

-- 3. GROUP MEMBERS TABLE
create table if not exists group_members (
  group_id uuid references groups(id) on delete cascade,
  player_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  turn_position int,
  score int not null default 0,
  primary key (group_id, player_id)
);

-- 4. GAME WORDS TABLE
create table if not exists game_words (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  player_id uuid references profiles(id),
  word text not null,
  word_lower text generated always as (lower(word)) stored,
  points int not null default 0,
  is_valid boolean not null default true,
  created_at timestamptz default now(),
  unique (group_id, word_lower)
);

-- 5. WORD DEFINITIONS CACHE
create table if not exists word_definitions (
  word text primary key,
  data jsonb not null,
  fetched_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table game_words enable row level security;
alter table word_definitions enable row level security;

-- Drop existing policies so the script can be re-run safely
drop policy if exists "profiles_select" on profiles;
drop policy if exists "profiles_insert" on profiles;
drop policy if exists "profiles_update" on profiles;
drop policy if exists "groups_select" on groups;
drop policy if exists "groups_insert" on groups;
drop policy if exists "groups_update" on groups;
drop policy if exists "group_members_select" on group_members;
drop policy if exists "group_members_insert" on group_members;
drop policy if exists "group_members_update" on group_members;
drop policy if exists "game_words_select" on game_words;
drop policy if exists "game_words_insert" on game_words;
drop policy if exists "word_definitions_select" on word_definitions;
drop policy if exists "word_definitions_insert" on word_definitions;

-- PROFILES: anyone can read, only own insert/update
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_insert" on profiles for insert with check (id = auth.uid());
create policy "profiles_update" on profiles for update using (id = auth.uid());

-- GROUPS: anyone can read, authenticated users can insert, host can update
create policy "groups_select" on groups for select using (true);
create policy "groups_insert" on groups for insert with check (auth.role() = 'authenticated');
create policy "groups_update" on groups for update using (host_id = auth.uid());

-- Helper: security definer function to check group membership without RLS recursion
create or replace function is_group_member(check_group_id uuid, check_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = check_group_id
      and player_id = check_user_id
  );
$$;

-- GROUP MEMBERS: members can see their group, authenticated users can insert own
create policy "group_members_select" on group_members for select using (
  is_group_member(group_id, auth.uid())
);
create policy "group_members_insert" on group_members for insert with check (player_id = auth.uid());
create policy "group_members_update" on group_members for update using (player_id = auth.uid());

-- GAME WORDS: group members can see, authenticated users can insert (validated by trigger)
create policy "game_words_select" on game_words for select using (
  is_group_member(group_id, auth.uid())
);
create policy "game_words_insert" on game_words for insert with check (
  player_id = auth.uid()
);

-- WORD DEFINITIONS: anyone can read/insert (shared cache)
create policy "word_definitions_select" on word_definitions for select using (true);
create policy "word_definitions_insert" on word_definitions for insert with check (auth.role() = 'authenticated');

-- ============================================================
-- GAME LOGIC: Trigger Function
-- ============================================================

create or replace function handle_new_word()
returns trigger
language plpgsql
security definer
as $$
declare
  v_group groups%rowtype;
  v_last_letter char(1);
  v_next_player_id uuid;
  v_word_length int;
  v_points int;
begin
  -- Lock the group row to prevent race conditions
  select * into v_group from groups where id = new.group_id for update;

  -- Check group is active
  if v_group.status != 'active' then
    raise exception 'Game is not active';
  end if;

  -- Check it's this player's turn (unless free_for_all mode or it's the first word)
  if v_group.game_mode != 'free_for_all' then
    if v_group.current_turn_player_id is not null and v_group.current_turn_player_id != new.player_id then
      raise exception 'Not your turn';
    end if;
  end if;

  -- Check word starts with the required letter (unless first word)
  if v_group.current_letter is not null then
    if lower(substr(new.word, 1, 1)) != lower(v_group.current_letter) then
      raise exception 'Word must start with %', v_group.current_letter;
    end if;
  end if;

  -- Calculate points: length - 2 (minimum 1)
  v_word_length := length(new.word);
  v_points := greatest(v_word_length - 2, 1);
  new.points := v_points;

  -- Update player's score in group_members
  update group_members set score = score + v_points
  where group_id = new.group_id and player_id = new.player_id;

  -- Update player's total_score and gems in profiles (100 points = 1 gem)
  update profiles set
    total_score = total_score + v_points,
    gems = gems + floor((total_score + v_points) / 100) - floor(total_score / 100)
  where id = new.player_id;

  -- Track daily activity
  perform track_user_activity(new.player_id);

  -- Determine next letter (last letter of new word)
  v_last_letter := lower(substr(new.word, v_word_length, 1));

  -- For free_for_all mode, don't advance turn — just update the letter
  if v_group.game_mode = 'free_for_all' then
    update groups set
      current_letter = v_last_letter
    where id = new.group_id;
    return new;
  end if;

  -- Find next player in turn order
  select gm.player_id into v_next_player_id
  from group_members gm
  where gm.group_id = new.group_id
    and gm.turn_position > (
      select turn_position from group_members where group_id = new.group_id and player_id = new.player_id
    )
  order by gm.turn_position
  limit 1;

  -- If no next player, wrap around to first
  if v_next_player_id is null then
    select player_id into v_next_player_id
    from group_members
    where group_id = new.group_id
    order by turn_position
    limit 1;
  end if;

  -- Update group state
  update groups set
    current_turn_player_id = v_next_player_id,
    current_letter = v_last_letter
  where id = new.group_id;

  return new;
end;
$$;

-- Create trigger
drop trigger if exists on_game_word_insert on game_words;
create trigger on_game_word_insert
  before insert on game_words
  for each row
  execute function handle_new_word();

-- ============================================================
-- HELPER: Function to start a game
-- ============================================================

create or replace function start_game(group_id_param uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_first_player_id uuid;
begin
  -- Get the first player (host or lowest turn_position)
  select player_id into v_first_player_id
  from group_members
  where group_id = group_id_param
  order by turn_position
  limit 1;

  -- Update group to active
  update groups set
    status = 'active',
    current_turn_player_id = v_first_player_id
  where id = group_id_param and status = 'waiting';
end;
$$;

-- ============================================================
-- HELPER: Skip a player's turn (when they time out)
-- Advances to the next player in turn order, keeping the same letter requirement.
-- ============================================================

create or replace function skip_turn(group_id_param uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_group groups%rowtype;
  v_next_player_id uuid;
  v_current_player_id uuid;
begin
  -- Lock and get current group state
  select * into v_group from groups where id = group_id_param for update;

  -- Only skip if game is active
  if v_group.status != 'active' then
    return;
  end if;

  v_current_player_id := v_group.current_turn_player_id;

  -- Find next player in turn order (after current player)
  select gm.player_id into v_next_player_id
  from group_members gm
  where gm.group_id = group_id_param
    and gm.turn_position > (
      select turn_position from group_members 
      where group_id = group_id_param and player_id = v_current_player_id
    )
  order by gm.turn_position
  limit 1;

  -- If no next player, wrap around to first
  if v_next_player_id is null then
    select player_id into v_next_player_id
    from group_members
    where group_id = group_id_param
    order by turn_position
    limit 1;
  end if;

  -- Update to next player (keep current_letter as-is)
  update groups set
    current_turn_player_id = v_next_player_id
  where id = group_id_param;
end;
$$;

-- ============================================================
-- HELPER: Generate a fun group code
-- ============================================================

-- Update RLS policies for profiles (allow reading avatar_url, email, gems)
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select using (true);

-- Drop old avatar_seed column references, use avatar_url
-- Helper: get total score for a user (used by profile view)
create or replace function get_total_score(user_id_param uuid)
returns integer
language sql
security definer
stable
as $$
  select coalesce(sum(score), 0) from group_members where player_id = user_id_param;
$$;

create or replace function generate_group_code()
returns text
language plpgsql
as $$
declare
  adjectives text[] := array['vibrant','clever','swift','brave','calm','eager','fancy','grand','happy','jolly','keen','lively','merry','noble','proud','quick','sharp','smart','sunny','witty'];
  nouns text[] := array['tiger','eagle','falcon','dolphin','panda','koala','lion','phoenix','wolf','hawk','otter','fox','bear','deer','owl','robin','swan','heron','crane','finch'];
  code text;
  done bool := false;
begin
  while not done loop
    code := adjectives[floor(random() * array_length(adjectives, 1) + 1)] || '-' ||
            nouns[floor(random() * array_length(nouns, 1) + 1)] || '-' ||
            floor(random() * 99 + 1)::text;
    if not exists (select 1 from groups where code = code) then
      done := true;
    end if;
  end loop;
  return code;
end;
$$;
