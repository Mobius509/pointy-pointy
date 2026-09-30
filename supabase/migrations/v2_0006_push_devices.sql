-- v2: push notification devices + per-kid daily reminder.
--
-- Replaces the v1 public.push_subscriptions table, which had no household
-- scoping (a "parent" push went to every parent device). Each row here is one
-- device that wants notifications, pinned to a household and to either a
-- parent (auth user) or a kid profile.
--
--   platform = 'web' → endpoint is the Web Push endpoint URL; p256dh/auth set.
--   platform = 'ios' → endpoint is the APNs device token (hex);
--                      apns_env says which APNs server issued it.

create table if not exists v2.push_devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references v2.households(id) on delete cascade,
  role text not null check (role in ('parent', 'kid')),
  user_id uuid references auth.users(id) on delete cascade,
  kid_profile_id uuid references v2.kid_profiles(id) on delete cascade,
  platform text not null check (platform in ('web', 'ios')),
  endpoint text not null unique,
  p256dh text,
  auth text,
  apns_env text check (apns_env in ('sandbox', 'production')),
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  constraint push_devices_owner check (
    (role = 'parent' and user_id is not null and kid_profile_id is null) or
    (role = 'kid' and kid_profile_id is not null and user_id is null)
  ),
  constraint push_devices_platform_fields check (
    (platform = 'web' and p256dh is not null and auth is not null) or
    (platform = 'ios' and apns_env is not null)
  )
);

create index if not exists push_devices_household_role_idx
  on v2.push_devices (household_id, role);
create index if not exists push_devices_kid_idx
  on v2.push_devices (kid_profile_id) where kid_profile_id is not null;

-- Service-role only: devices are registered through server actions and the
-- native API after the caller is authenticated. No client policies.
alter table v2.push_devices enable row level security;

-- Daily "don't forget your points" reminder, in the household's timezone.
-- reminder_time null = off. last_reminded_on stops the cron from sending
-- twice on the same local day.
alter table v2.kid_profiles
  add column if not exists reminder_time time,
  add column if not exists last_reminded_on date;
