-- v2: the new kid home (Stats page).
--
-- kid_profiles.hue: the kid's own color — an OKLCH hue in degrees (0–359)
-- that the whole kid app's pastel palette (and their avatar) is shifted to.
-- Null = the default lavender (see src/lib/kid-palette.ts).
--
-- completions.celebrated_at: when the kid played the celebration for an
-- approval. "Seen" used to live in each device's browser storage; on the
-- server, a celebration played on the iPhone doesn't come back on the web.
-- Everything approved before this migration counts as celebrated.
--
-- Written to be safe to run more than once.

alter table v2.kid_profiles
  add column if not exists hue smallint check (hue between 0 and 359);

alter table v2.completions
  add column if not exists celebrated_at timestamptz;

update v2.completions
  set celebrated_at = now()
  where status = 'approved' and celebrated_at is null
    and not exists (select 1 from v2.completions c2 where c2.celebrated_at is not null limit 1);

create index if not exists completions_uncelebrated_idx
  on v2.completions (kid_profile_id)
  where status = 'approved' and celebrated_at is null;
