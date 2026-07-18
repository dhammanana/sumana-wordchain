-- Migration: Add new profile fields for social auth, gems, and activity tracking
-- Run this in Supabase SQL Editor

-- Add new columns to profiles (if they don't exist)
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists email text;
alter table profiles add column if not exists provider text;
alter table profiles add column if not exists gems integer not null default 0;
alter table profiles add column if not exists total_score integer not null default 0;
alter table profiles add column if not exists total_days_active integer not null default 0;
alter table profiles add column if not exists last_active_date date;

-- Create function to track daily activity
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

-- Create function to get total score
create or replace function get_total_score(user_id_param uuid)
returns integer
language sql
security definer
stable
as $$
  select coalesce(sum(score), 0) from group_members where player_id = user_id_param;
$$;

-- Update the handle_new_word trigger to also update profiles.total_score and gems
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

-- Drop old trigger and recreate
drop trigger if exists on_game_word_insert on game_words;
create trigger on_game_word_insert
  before insert on game_words
  for each row
  execute function handle_new_word();