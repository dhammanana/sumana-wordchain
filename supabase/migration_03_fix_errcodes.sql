-- Migration 03: Fix custom error codes in handle_new_word()
-- PostgreSQL rejects custom errcodes like 'WSTART', 'NTURN', 'GNACT'
-- because they are not valid SQLSTATE codes.
-- The client-side code already detects errors by matching message text,
-- so the errcodes are unnecessary.

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
