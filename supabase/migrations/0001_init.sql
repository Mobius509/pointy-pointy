-- Pointy Pointy initial schema.
-- Apply by either:
--   1) supabase db push (if using the Supabase CLI), OR
--   2) Pasting this whole file into Supabase Dashboard → SQL Editor and running it.

create extension if not exists "uuid-ossp";

-- Editable task templates: the daily checklist + bonus library.
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  points integer not null check (points >= 0),
  recurring boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists tasks_active_recurring_sort_idx
  on public.tasks (active, recurring, sort_order);

-- Immutable log of every point-earning event (daily completions + bonuses).
create table if not exists public.completions (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references public.tasks(id) on delete set null,
  task_name_snapshot text not null,
  points_snapshot integer not null check (points_snapshot >= 0),
  completed_on date not null,
  completed_at timestamptz not null default now(),
  is_bonus boolean not null default false,
  note text
);

create index if not exists completions_completed_on_idx
  on public.completions (completed_on desc);
create index if not exists completions_completed_at_idx
  on public.completions (completed_at desc);

-- One completion per recurring task per local day.
create unique index if not exists completions_unique_per_day
  on public.completions (task_id, completed_on)
  where task_id is not null and is_bonus = false;

-- Goals (only one active at a time, history kept).
create table if not exists public.goals (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  target_points integer not null check (target_points > 0),
  started_at timestamptz not null default now(),
  redeemed_at timestamptz
);

create index if not exists goals_active_idx
  on public.goals (redeemed_at) where redeemed_at is null;

-- Singleton settings row (parent PIN, timezone).
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  parent_pin_hash text,
  timezone text not null default 'America/New_York'
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

-- Row Level Security: only authenticated users (the family account) can read/write
-- through the anon/auth client. The server-side service role bypasses RLS for
-- privileged actions (parent admin) and for the kid-view INSERT helper.
alter table public.tasks enable row level security;
alter table public.completions enable row level security;
alter table public.goals enable row level security;
alter table public.settings enable row level security;

drop policy if exists "auth read tasks"        on public.tasks;
drop policy if exists "auth read completions"  on public.completions;
drop policy if exists "auth read goals"        on public.goals;
drop policy if exists "auth read settings"     on public.settings;

create policy "auth read tasks"        on public.tasks       for select using (auth.role() = 'authenticated');
create policy "auth read completions"  on public.completions for select using (auth.role() = 'authenticated');
create policy "auth read goals"        on public.goals       for select using (auth.role() = 'authenticated');
create policy "auth read settings"     on public.settings    for select using (auth.role() = 'authenticated');
