-- v2: streaks and arcade tickets.
--
-- A parent sets up streaks: a set of daily tasks to do every day, how many
-- days in a row earns a reward, and the bonus points. Every N days of an
-- unbroken run pays the bonus (as an approved bonus completion) and gives
-- the kid an arcade ticket. Tickets save up; each is one play of a mini
-- game (see src/lib/v2/streaks.ts).
--
-- Written to be safe to run more than once.

create table if not exists v2.streaks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references v2.households(id) on delete cascade,
  name text not null,
  days_required integer not null default 7 check (days_required between 2 and 365),
  bonus_points integer not null default 10 check (bonus_points between 0 and 1000),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists streaks_household_idx on v2.streaks (household_id, sort_order);

-- School-day streaks: Saturdays and Sundays don't count and don't break it.
alter table v2.streaks
  add column if not exists skip_weekends boolean not null default false;

-- Which tasks make up each streak (a task can be in several).
create table if not exists v2.streak_tasks (
  streak_id uuid not null references v2.streaks(id) on delete cascade,
  task_id uuid not null references v2.tasks(id) on delete cascade,
  primary key (streak_id, task_id)
);

-- One row per reward paid. The unique key makes paying the same reward
-- twice impossible, however approvals arrive.
create table if not exists v2.streak_rewards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references v2.households(id) on delete cascade,
  streak_id uuid not null references v2.streaks(id) on delete cascade,
  kid_profile_id uuid not null references v2.kid_profiles(id) on delete cascade,
  reached_on date not null,         -- the day the run hit N, 2N, 3N…
  reward_number integer not null,   -- 1 at N days, 2 at 2N… (the ticket tier)
  completion_id uuid references v2.completions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (streak_id, kid_profile_id, reached_on)
);

-- Arcade tickets: unclaimed until the kid uses one; then `games` holds
-- the game it played and `expires_at` is when the kid closed it (spent).
create table if not exists v2.arcade_tickets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references v2.households(id) on delete cascade,
  kid_profile_id uuid not null references v2.kid_profiles(id) on delete cascade,
  streak_reward_id uuid references v2.streak_rewards(id) on delete set null,
  tier integer not null check (tier >= 1),
  games text[],
  claimed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists arcade_tickets_kid_idx on v2.arcade_tickets (kid_profile_id, created_at desc);

-- Service-role only: read and written by server code after the kid/parent
-- session is checked. No client policies.
alter table v2.streaks enable row level security;
alter table v2.streak_tasks enable row level security;
alter table v2.streak_rewards enable row level security;
alter table v2.arcade_tickets enable row level security;
