-- ============================================================
-- Migration 06: leave_game() RPC
-- ============================================================
-- Apply AFTER schema.sql and migrations 02-05.
-- Fixes the reliability gap where a leaving player's turn would stall:
--   * removes the member,
--   * reassigns host if the host left (so the group stays manageable),
--   * advances the turn if it was the leaver's turn,
--   * ends the game (settling combat gems) if fewer than 2 players remain.
-- Mirrors the pure helper advanceTurnAfterLeave() in src/gameLogic.js.
-- ============================================================

create or replace function leave_game(group_id_param uuid, player_id_param uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_group groups%rowtype;
  v_remaining int;
  v_next uuid;
  v_host uuid;
begin
  select * into v_group from groups where id = group_id_param for update;
  if not found then return; end if;

  -- Remove the member
  delete from group_members
  where group_id = group_id_param and player_id = player_id_param;

  select count(*) into v_remaining
  from group_members where group_id = group_id_param;

  -- Fewer than 2 players left: the game cannot continue.
  if v_remaining < 2 then
    if v_group.status = 'active' then
      perform end_game(group_id_param);   -- records results + settles combat gems
    else
      update groups set status = 'finished' where id = group_id_param;
    end if;
    return;
  end if;

  -- If the leaving player was the host, reassign host to another member so the
  -- group can still be updated/started by someone.
  if v_group.host_id = player_id_param then
    select player_id into v_host
    from group_members where group_id = group_id_param
    order by turn_position limit 1;
    if v_host is not null then
      update groups set host_id = v_host where id = group_id_param;
    end if;
  end if;

  -- If it was the leaving player's turn, advance to the next player in order.
  if v_group.current_turn_player_id = player_id_param then
    select gm.player_id into v_next
    from group_members gm
    where gm.group_id = group_id_param
      and gm.turn_position > (
        select turn_position from group_members
        where group_id = group_id_param and player_id = player_id_param
      )
    order by gm.turn_position limit 1;

    if v_next is null then
      select player_id into v_next
      from group_members where group_id = group_id_param
      order by turn_position limit 1;
    end if;

    update groups set current_turn_player_id = v_next where id = group_id_param;
  end if;
end;
$$;
