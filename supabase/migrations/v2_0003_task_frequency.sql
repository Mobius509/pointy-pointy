-- v2: per-task recurrence cadence (daily / weekly / biweekly / monthly / yearly).
--
-- Each task gets a `frequency`. Completions get a `period_key` (computed in
-- the application from the task's frequency) so the unique-completion-per-
-- period constraint applies regardless of cadence: a weekly task can be
-- completed once per ISO week, a monthly task once per calendar month, etc.

alter table v2.tasks
  add column if not exists frequency text not null default 'daily'
  check (frequency in ('daily', 'weekly', 'biweekly', 'monthly', 'yearly'));

alter table v2.completions
  add column if not exists period_key text;

-- Backfill: every existing completion was for a daily task, so its period
-- key is just D-<completed_on>.
update v2.completions
   set period_key = 'D-' || to_char(completed_on, 'YYYY-MM-DD')
 where period_key is null;

-- Replace the old per-day unique index with a per-period one. The old index
-- only allowed one completion per (kid, task, day); the new one enforces one
-- per (kid, task, computed period bucket).
drop index if exists v2.completions_unique_per_kid_per_day;
create unique index if not exists completions_unique_per_kid_per_period
  on v2.completions (kid_profile_id, task_id, period_key)
  where task_id is not null and is_bonus = false and period_key is not null;
