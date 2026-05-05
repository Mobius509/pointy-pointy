-- ============================================================================
-- One-shot migration: copy your v1 (single-family) data into your v2 household.
--
-- Prereq:
--   1. You've signed up at /v2/sign-up. That created an auth.users row, a
--      v2.households row, and a v2.household_members link.
--   2. You haven't added any kids yet via /v2/.../parent/kids — this script
--      will create the first kid for you. (If you already have kids it'll
--      use the first one.)
--   3. You know the bcrypt hash of the PIN you want for the kid. To generate
--      one in Node:
--        node -e "console.log(require('bcryptjs').hashSync('1234', 10))"
--      Paste the resulting hash (starts with `$2a$10$...`) into v_kid_pin_hash.
--
-- Then fill in the four placeholder values below, paste the whole file into
-- Supabase Dashboard → SQL Editor, and run.
-- ============================================================================

do $$
declare
  -- ===== EDIT THESE FOUR =====
  v_email           text := 'matt.steenburg@fantasy.co';      -- the email you signed up with
  v_kid_name        text := 'Kid';                              -- your kid's name
  v_kid_avatar      text := '🐶';
  v_kid_pin_hash    text := 'PASTE_BCRYPT_HASH_HERE';          -- bcrypt hash of the desired PIN
  -- ============================

  v_user_id      uuid;
  v_household_id uuid;
  v_kid_id       uuid;
  v_task_count   int := 0;
  v_goal_count   int := 0;
  v_comp_count   int := 0;
begin
  -- 1. Look up the auth user
  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is null then
    raise exception 'No auth user found for email "%". Sign up at /v2/sign-up first.', v_email;
  end if;

  -- 2. Look up their household
  select household_id into v_household_id
    from v2.household_members
   where user_id = v_user_id
   order by created_at asc
   limit 1;
  if v_household_id is null then
    raise exception 'No household for user %. Sign up at /v2/sign-up first.', v_email;
  end if;

  -- 3. Create or reuse the first kid profile
  select id into v_kid_id
    from v2.kid_profiles
   where household_id = v_household_id
   order by sort_order asc
   limit 1;

  if v_kid_id is null then
    if v_kid_pin_hash = 'PASTE_BCRYPT_HASH_HERE' then
      raise exception 'Generate a bcrypt hash for the kid PIN and paste it into v_kid_pin_hash before running.';
    end if;
    insert into v2.kid_profiles (household_id, name, avatar_emoji, pin_hash, sort_order)
      values (v_household_id, v_kid_name, v_kid_avatar, v_kid_pin_hash, 10)
      returning id into v_kid_id;
    raise notice 'Created kid_profile %, name %', v_kid_id, v_kid_name;
  else
    raise notice 'Reusing existing kid_profile %', v_kid_id;
  end if;

  -- 4. Copy active recurring tasks. We don't dedupe; if you've already added
  --    tasks via the v2 admin, this will append duplicates — clear those
  --    first or skip this block.
  with src as (
    select name, description, points, recurring, active, sort_order
      from public.tasks
     where recurring = true and active = true
  ),
  ins as (
    insert into v2.tasks (household_id, name, description, points, recurring, active, sort_order)
    select v_household_id, src.name, src.description, src.points, src.recurring, src.active, src.sort_order
      from src
    returning 1
  )
  select count(*) into v_task_count from ins;
  raise notice 'Copied % task(s)', v_task_count;

  -- 5. Copy active goals (those with redeemed_at is null) for this kid.
  with src as (
    select name, target_points, started_at
      from public.goals
     where redeemed_at is null
  ),
  ins as (
    insert into v2.goals (household_id, kid_profile_id, name, target_points, started_at)
    select v_household_id, v_kid_id, src.name, src.target_points, src.started_at
      from src
    returning 1
  )
  select count(*) into v_goal_count from ins;
  raise notice 'Copied % goal(s)', v_goal_count;

  -- 6. Copy ALL completions (approved bonuses + recurring task completions)
  --    into the kid's history. task_id is intentionally null in the copy —
  --    completion rows preserve task_name_snapshot/points_snapshot, which is
  --    what the activity log displays. This avoids having to re-map ids.
  with ins as (
    insert into v2.completions (
      household_id, kid_profile_id, task_id,
      task_name_snapshot, points_snapshot,
      completed_on, completed_at,
      is_bonus, status, note
    )
    select
      v_household_id, v_kid_id, null,
      task_name_snapshot, points_snapshot,
      completed_on, completed_at,
      is_bonus, coalesce(status, 'approved'), note
    from public.completions
    returning 1
  )
  select count(*) into v_comp_count from ins;
  raise notice 'Copied % completion(s)', v_comp_count;

  raise notice '✓ Migration complete. household=% kid=%', v_household_id, v_kid_id;
end $$;
