-- «نقود الفريق الذكي»: the coins of a series in team mode («المسلسل الذكي»), separate from each person's «النقود الذكية».
-- The series' owner moves coins into it from their own (and back), the site's owner can add some; every paid step of
-- the series' scenes is taken from it while the series is in team mode, whoever on the team presses.
-- Written by the server only (service role) through adjust_team_coins; the browser reads nothing here directly.

create table if not exists public.team_coin_wallets (
  series_id uuid primary key references public.film_series (id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.team_coin_ledger (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.film_series (id) on delete cascade,
  -- who did it (the member who pressed, the owner who moved coins); null for the site's owner's grant
  user_id uuid references auth.users (id) on delete set null,
  delta integer not null,
  reason text not null,          -- fund · withdraw · grant · reserve · settle · refund
  ref text not null default '',  -- the film job id, or a note
  label text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists team_coin_ledger_series_idx on public.team_coin_ledger (series_id, created_at desc);
create index if not exists team_coin_ledger_ref_idx on public.team_coin_ledger (ref);

alter table public.team_coin_wallets enable row level security;
alter table public.team_coin_ledger enable row level security;
revoke all on public.team_coin_wallets, public.team_coin_ledger from anon, authenticated;

-- Atomic balance change, like adjust_smart_coins: a debit below zero (without p_allow_negative) changes nothing and
-- returns null. Returns the new balance.
create or replace function public.adjust_team_coins(p_series uuid, p_user uuid, p_delta integer, p_reason text, p_ref text default '', p_label text default '', p_allow_negative boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  insert into team_coin_wallets (series_id, balance) values (p_series, 0) on conflict (series_id) do nothing;
  update team_coin_wallets
     set balance = balance + p_delta, updated_at = now()
   where series_id = p_series and (p_allow_negative or balance + p_delta >= 0)
  returning balance into new_balance;
  if new_balance is null then
    return null;
  end if;
  insert into team_coin_ledger (series_id, user_id, delta, reason, ref, label) values (p_series, p_user, p_delta, p_reason, p_ref, p_label);
  return new_balance;
end;
$$;
revoke all on function public.adjust_team_coins(uuid, uuid, integer, text, text, text, boolean) from public, anon, authenticated;

-- What each team member may do, set by the series' owner: the steps they work on (null = all of them) and how many
-- attempts (paid replies and generations) they may make (null = no limit). A failed attempt is given back.
alter table public.film_series_members add column if not exists stages text[];
alter table public.film_series_members add column if not exists max_attempts integer check (max_attempts is null or max_attempts between 0 and 100000);
alter table public.film_series_members add column if not exists used_attempts integer not null default 0;

-- Takes one attempt when the member still has one (true), else changes nothing (false).
create or replace function public.take_team_attempt(p_series uuid, p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update film_series_members
     set used_attempts = used_attempts + 1
   where series_id = p_series and user_id = p_user and (max_attempts is null or used_attempts < max_attempts)
  returning used_attempts into n;
  return n is not null;
end;
$$;

create or replace function public.give_team_attempt(p_series uuid, p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update film_series_members set used_attempts = greatest(0, used_attempts - 1) where series_id = p_series and user_id = p_user;
$$;
revoke all on function public.take_team_attempt(uuid, uuid) from public, anon, authenticated;
revoke all on function public.give_team_attempt(uuid, uuid) from public, anon, authenticated;
