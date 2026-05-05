-- v2: co-parent invites.
-- Parent A generates a one-time code; Parent B opens /v2/sign-up?invite=<code>
-- and gets auto-added to the household after they pick a password.

create table if not exists v2.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references v2.households(id) on delete cascade,
  code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Soft expiry: queries reject anything past expires_at, parents can extend
  -- by re-issuing.
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null
);

create index if not exists household_invites_household_idx
  on v2.household_invites (household_id);
create index if not exists household_invites_code_idx
  on v2.household_invites (code);

alter table v2.household_invites enable row level security;

-- Parents can manage invites for their own household. Anonymous lookup by
-- code happens server-side via the service-role client, never via the public
-- API, so there's no public-read policy here.
drop policy if exists "members manage invites" on v2.household_invites;
create policy "members manage invites" on v2.household_invites
  for all using (household_id in (select v2.user_household_ids()))
       with check (household_id in (select v2.user_household_ids()));

grant select, insert, update, delete on v2.household_invites
  to authenticated, service_role;
