-- ============================================================================
-- Delta sync: pull v1 completions newer than what's already in v2.
--
-- The one-shot migrate_v1_to_v2.sql ran a long time ago and copied a snapshot.
-- Since then v1 has continued to receive day-to-day completions (Freya's
-- checklist) while v2 has only seen dev/test edits. This script catches v2 up
-- without disturbing v2-only data (milestones, household members, kid PINs).
--
-- Safe to re-run: only inserts completions strictly newer than the latest
-- one already in v2 for the target household.
--
-- Edit the slug below if your household URL is different from mmR5mdaReR.
-- ============================================================================

do $$
declare
  v_slug          text := 'mmR5mdaReR';
  v_household_id  uuid;
  v_kid_id        uuid;
  v_last_v2_at    timestamptz;
  v_inserted      int := 0;
begin
  select id into v_household_id from v2.households where slug = v_slug;
  if v_household_id is null then
    raise exception 'No v2 household with slug "%". Edit v_slug at the top of this script.', v_slug;
  end if;

  -- Use the first (lowest sort_order) kid in the household. If you have
  -- more than one kid in v2, you'll want to split this script per-kid.
  select id into v_kid_id
    from v2.kid_profiles
   where household_id = v_household_id
   order by sort_order asc
   limit 1;
  if v_kid_id is null then
    raise exception 'No kid_profile in household %', v_household_id;
  end if;

  -- Floor — if v2 is empty for this household, take everything from v1.
  select coalesce(max(completed_at), '1970-01-01'::timestamptz) into v_last_v2_at
    from v2.completions
   where household_id = v_household_id;

  raise notice 'Last v2 completion for household %: %', v_household_id, v_last_v2_at;

  -- Copy v1 completions strictly newer than the v2 high-water mark.
  -- We preserve task_name_snapshot/points_snapshot (what the activity log
  -- shows) and leave task_id null so we don't have to re-map IDs across
  -- schemas. period_key is computed as the daily bucket — fine because v1
  -- pre-dates the weekly/monthly frequency feature.
  with ins as (
    insert into v2.completions (
      household_id, kid_profile_id, task_id,
      task_name_snapshot, points_snapshot,
      completed_on, completed_at, period_key,
      is_bonus, status, note
    )
    select
      v_household_id, v_kid_id, null,
      task_name_snapshot, points_snapshot,
      completed_on, completed_at,
      'D-' || to_char(completed_on, 'YYYY-MM-DD'),
      is_bonus,
      coalesce(status, 'approved'),
      note
    from public.completions
    where completed_at > v_last_v2_at
    returning 1
  )
  select count(*) into v_inserted from ins;

  raise notice '✓ Inserted % new completion(s) into v2.completions', v_inserted;
end $$;

notify pgrst, 'reload schema';
