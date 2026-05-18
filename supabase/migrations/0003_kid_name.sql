-- v1: store the kid's name so push notifications can use it instead of
-- the generic "Kid…" placeholder.

alter table public.settings
  add column if not exists kid_name text;

-- Seed the existing row with the current kid's name so notifications work
-- right away. Parent can change it via Settings.
update public.settings
   set kid_name = 'Freya'
 where id = 1 and (kid_name is null or kid_name = '');
