-- Pointy Points v2 — goal milestones.
-- A milestone is a small unlock parents add to a goal (e.g. "Ice cream" at
-- 500 points on a 5000-point "Get a dog" goal). The kid sees them on the
-- progress bar so they have visible mid-goal rewards to aim for.
--
-- household_id is duplicated for RLS scoping (so we don't have to join through
-- v2.goals on every read).
--
-- Apply by pasting into Supabase SQL Editor (or via `supabase db push`).

create table if not exists v2.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references v2.households(id) on delete cascade,
  goal_id uuid not null references v2.goals(id) on delete cascade,
  name text not null,
  points integer not null check (points > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists goal_milestones_goal_points_idx
  on v2.goal_milestones (goal_id, points);

alter table v2.goal_milestones enable row level security;

drop policy if exists "members manage goal_milestones" on v2.goal_milestones;
create policy "members manage goal_milestones" on v2.goal_milestones
  for all using (household_id in (select v2.user_household_ids()))
       with check (household_id in (select v2.user_household_ids()));

-- The default privileges set in v2_0001 already cover new tables in this
-- schema (the `alter default privileges in schema v2 grant ...` statement),
-- but call it out explicitly to be safe.
grant select, insert, update, delete on v2.goal_milestones
  to authenticated, service_role;
