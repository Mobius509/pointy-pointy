-- Replace name-based household slugs with opaque random IDs.
--
-- Background: v2.households.slug used to be derived from the family name
-- (e.g. "steenburg-folliott"). Anyone who knew a family's name could hit
-- /v2/h/{their-name}, see the kid picker (names + avatars), and start
-- brute-forcing 4-digit PINs. New code path generates a random 10-char
-- URL-safe string; this migration retroactively does the same for every
-- existing row.
--
-- Alphabet matches src/lib/v2/household-id.ts (no 0/1/I/l/O).
-- 56 chars × 10 positions ≈ 3×10^17 distinct slugs.

create or replace function v2._random_slug(out slug text)
  language plpgsql
  as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  alphabet_len constant integer := length(alphabet);
  i integer;
begin
  slug := '';
  for i in 1..10 loop
    -- floor(random() * len) is in [0, len-1]; substring is 1-indexed.
    slug := slug || substring(alphabet from (floor(random() * alphabet_len)::integer + 1) for 1);
  end loop;
end;
$$;

do $$
declare
  r record;
  new_slug text;
  attempt integer;
begin
  for r in select id from v2.households loop
    -- Try a few times in case of an astronomical collision.
    attempt := 0;
    loop
      attempt := attempt + 1;
      new_slug := (select v2._random_slug());
      exit when not exists (select 1 from v2.households where slug = new_slug);
      if attempt > 6 then
        raise exception 'Could not allocate a unique slug for household %', r.id;
      end if;
    end loop;
    update v2.households set slug = new_slug where id = r.id;
  end loop;
end
$$;

drop function v2._random_slug();

notify pgrst, 'reload schema';
