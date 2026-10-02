-- v2: "any N of these" streaks, and parent-approved streak days.
--
-- streaks.tasks_needed: how many of the streak's tasks make a day count —
-- e.g. a streak of Make lunch, Practice piano, Homework, Read with 3 needed:
-- any three of them do. Null = all of them (how streaks worked before).
--
-- streak_excused_days: "count this day" — a parent approved a streak day
-- even though not enough of its tasks were done (sick day, holiday…). It
-- counts as a streak day.
--
-- Written to be safe to run more than once.

alter table v2.streaks
  add column if not exists tasks_needed smallint check (tasks_needed >= 1);

create table if not exists v2.streak_excused_days (
  streak_id uuid not null references v2.streaks(id) on delete cascade,
  kid_profile_id uuid not null references v2.kid_profiles(id) on delete cascade,
  household_id uuid not null references v2.households(id) on delete cascade,
  day date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (streak_id, kid_profile_id, day)
);

-- Service-role only: read and written by server code after the parent's
-- session is checked. No client policies.
alter table v2.streak_excused_days enable row level security;
