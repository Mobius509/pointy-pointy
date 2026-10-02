-- v2: which days each streak task is needed, and parent-approved days.
--
-- streak_tasks.days: the weekdays the task is needed for the streak, as a
-- bitmask — bit 0 = Monday … bit 6 = Sunday; 127 = every day. On a day a
-- task isn't needed it doesn't have to be done, and a day with no tasks
-- needed is a rest day (doesn't count, doesn't break the streak — like a
-- weekend with "skip weekends").
--
-- streak_excused_days: "count this day" — a parent approved a streak day
-- even though its tasks weren't all done (sick day, holiday…). It counts as
-- a streak day.
--
-- Written to be safe to run more than once.

alter table v2.streak_tasks
  add column if not exists days smallint not null default 127 check (days between 1 and 127);

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
