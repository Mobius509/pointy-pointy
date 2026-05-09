-- v1: web-push subscription registry.
-- One row per registered device. `role` distinguishes "kid" devices (which
-- get notified when a parent approves something) from "parent" devices
-- (which get notified when a kid submits something).
--
-- Each subscription is identified by its endpoint URL — the same browser
-- + origin always returns the same endpoint, so re-subscribing is a no-op.

create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  role text not null check (role in ('parent', 'kid')),
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_role_idx
  on public.push_subscriptions (role);

-- Service-role only. Subscriptions are managed via Server Actions; we
-- never query them from the browser, so no public read/write policies.
alter table public.push_subscriptions enable row level security;
