-- v2: family high scores for the celebration mini games.
--
-- One row per household per game — the best score anyone in the family
-- has set, and which kid set it. A new score only replaces it if higher.
-- Games: pinata, balloons, worm, chomper, asteroids (and future ones).

create table if not exists v2.high_scores (
  household_id uuid not null references v2.households(id) on delete cascade,
  game text not null,
  score integer not null check (score >= 0),
  kid_profile_id uuid references v2.kid_profiles(id) on delete set null,
  achieved_at timestamptz not null default now(),
  primary key (household_id, game)
);

-- Service-role only: read and written through the kid view's server
-- actions after the kid session is checked. No client policies.
alter table v2.high_scores enable row level security;
