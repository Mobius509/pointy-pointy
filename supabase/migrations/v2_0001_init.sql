-- Pointy Points v2 — multi-family schema.
-- Lives in its own `v2` schema so the existing single-family `public.*` tables
-- and the production app at / and /parent are untouched. Apply by pasting into
-- the Supabase SQL Editor (or via `supabase db push` if using the CLI).

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

create schema if not exists v2;

-- ============================================================================
-- Tables
-- ============================================================================

-- A family. `slug` is the URL identifier, e.g. /v2/h/steenburgs.
create table if not exists v2.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

-- Parents: links a Supabase auth.users row to a household.
-- Composite PK so a parent could later belong to multiple households.
create table if not exists v2.household_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references v2.households(id) on delete cascade,
  role text not null check (role = 'parent'),
  created_at timestamptz not null default now(),
  primary key (user_id, household_id)
);

create index if not exists household_members_household_idx
  on v2.household_members (household_id);

-- Kids: not auth.users, just rows scoped to the household with a PIN.
create table if not exists v2.kid_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references v2.households(id) on delete cascade,
  name text not null,
  pin_hash text not null,                 -- bcrypt
  avatar_emoji text not null default '🐶',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists kid_profiles_household_sort_idx
  on v2.kid_profiles (household_id, sort_order);

-- Editable task templates for the daily checklist (family-wide).
create table if not exists v2.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references v2.households(id) on delete cascade,
  name text not null,
  description text,
  points integer not null check (points >= 0),
  recurring boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists tasks_household_active_recurring_sort_idx
  on v2.tasks (household_id, active, recurring, sort_order);

-- Per-kid completion log (and bonus awards). Each kid earns separately.
create table if not exists v2.completions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references v2.households(id) on delete cascade,
  kid_profile_id uuid references v2.kid_profiles(id) on delete cascade,
  task_id uuid references v2.tasks(id) on delete set null,
  task_name_snapshot text not null,
  points_snapshot integer not null check (points_snapshot >= 0),
  completed_on date not null,
  completed_at timestamptz not null default now(),
  is_bonus boolean not null default false,
  status text not null default 'approved' check (status in ('pending', 'approved')),
  note text
);

create index if not exists completions_household_completed_at_idx
  on v2.completions (household_id, completed_at desc);
create index if not exists completions_kid_completed_on_idx
  on v2.completions (kid_profile_id, completed_on desc);
create index if not exists completions_household_pending_idx
  on v2.completions (household_id, completed_at desc) where status = 'pending';

-- One completion per (kid, recurring task) per local day. Lets two kids
-- independently complete the same family task on the same day.
create unique index if not exists completions_unique_per_kid_per_day
  on v2.completions (kid_profile_id, task_id, completed_on)
  where task_id is not null and is_bonus = false;

-- Goals. Currently per-kid (kid_profile_id NOT NULL); the column is left
-- nullable so a future household-wide goal can be added without migration.
create table if not exists v2.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references v2.households(id) on delete cascade,
  kid_profile_id uuid references v2.kid_profiles(id) on delete cascade,
  name text not null,
  target_points integer not null check (target_points > 0),
  started_at timestamptz not null default now(),
  redeemed_at timestamptz
);

create index if not exists goals_active_idx
  on v2.goals (household_id, kid_profile_id) where redeemed_at is null;

-- ============================================================================
-- Row-Level Security
--
-- Parents (authenticated users) can read/write rows belonging to households
-- they're a member of. The kid view bypasses RLS server-side: kid actions go
-- through Next.js Server Actions that use the service-role key only after
-- verifying a signed kid_session cookie (PIN-verified).
-- ============================================================================

alter table v2.households       enable row level security;
alter table v2.household_members enable row level security;
alter table v2.kid_profiles     enable row level security;
alter table v2.tasks            enable row level security;
alter table v2.completions      enable row level security;
alter table v2.goals            enable row level security;

-- Helper: returns the set of household_ids the current auth user is a member of.
create or replace function v2.user_household_ids()
returns setof uuid
language sql stable security invoker
as $$
  select household_id
    from v2.household_members
   where user_id = auth.uid()
$$;

-- households: members read; only service_role inserts/updates/deletes
-- (sign-up flow runs server-side with elevated privileges).
drop policy if exists "members read households" on v2.households;
create policy "members read households" on v2.households
  for select using (id in (select v2.user_household_ids()));

-- household_members: each user reads their own membership rows.
drop policy if exists "members read own memberships" on v2.household_members;
create policy "members read own memberships" on v2.household_members
  for select using (user_id = auth.uid());

-- kid_profiles: full access for parents of the household.
drop policy if exists "members manage kid_profiles" on v2.kid_profiles;
create policy "members manage kid_profiles" on v2.kid_profiles
  for all using (household_id in (select v2.user_household_ids()))
       with check (household_id in (select v2.user_household_ids()));

-- tasks: full access for parents of the household.
drop policy if exists "members manage tasks" on v2.tasks;
create policy "members manage tasks" on v2.tasks
  for all using (household_id in (select v2.user_household_ids()))
       with check (household_id in (select v2.user_household_ids()));

-- completions: full access for parents of the household.
drop policy if exists "members manage completions" on v2.completions;
create policy "members manage completions" on v2.completions
  for all using (household_id in (select v2.user_household_ids()))
       with check (household_id in (select v2.user_household_ids()));

-- goals: full access for parents of the household.
drop policy if exists "members manage goals" on v2.goals;
create policy "members manage goals" on v2.goals
  for all using (household_id in (select v2.user_household_ids()))
       with check (household_id in (select v2.user_household_ids()));

-- ============================================================================
-- Schema-level grants for the PostgREST roles Supabase uses.
-- ============================================================================

grant usage on schema v2 to authenticated, service_role;
grant select, insert, update, delete on all tables in schema v2 to authenticated, service_role;
grant execute on function v2.user_household_ids() to authenticated, service_role;

alter default privileges in schema v2
  grant select, insert, update, delete on tables to authenticated, service_role;
