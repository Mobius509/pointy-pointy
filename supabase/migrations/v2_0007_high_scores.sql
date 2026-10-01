-- v2: family high scores for the celebration mini games.
--
-- One row per household per game — the best score anyone in the family
-- has set. A new score only replaces it if higher. The holder is a kid
-- (kid_profile_id) or, when parents play too, a parent (user_id);
-- holder_name is the name/initials shown beside it ("FRE", "DAD").
-- Games: pinata, balloons, worm, chomper, asteroids, mole (and future ones).
--
-- Written to be safe to run more than once.

create table if not exists v2.high_scores (
  household_id uuid not null references v2.households(id) on delete cascade,
  game text not null,
  score integer not null check (score >= 0),
  kid_profile_id uuid references v2.kid_profiles(id) on delete set null,
  achieved_at timestamptz not null default now(),
  primary key (household_id, game)
);

alter table v2.high_scores
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists holder_name text;

-- Service-role only: read and written through server actions after the
-- kid/parent session is checked. No client policies.
alter table v2.high_scores enable row level security;

-- Parents can play the mini games and set high scores to challenge the
-- kids (a toggle in parent Settings → Celebrations).
alter table v2.households
  add column if not exists parents_play boolean not null default true;

-- What a parent's high scores show as ("DAD", "MOM", initials…).
alter table v2.household_members
  add column if not exists score_name text;

-- Kids' arcade initials for high scores, set by parents (blank = default:
-- first initial + the family name's initial, e.g. Freya Steenburg → FS).
alter table v2.kid_profiles
  add column if not exists initials text;
