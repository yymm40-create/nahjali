-- «النقود الذكية»: each user's coin balance and every coin movement.
-- Written by the server only (service role) through adjust_smart_coins; each user can read their own.
create table if not exists public.smart_coin_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.smart_coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  reason text not null,          -- grant · reserve · settle · refund · purchase
  ref text not null default '',  -- e.g. the film job id, or the owner's note
  label text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists smart_coin_ledger_user_idx on public.smart_coin_ledger (user_id, created_at desc);
create index if not exists smart_coin_ledger_ref_idx on public.smart_coin_ledger (ref);

alter table public.smart_coin_wallets enable row level security;
alter table public.smart_coin_ledger enable row level security;
drop policy if exists "own smart coin wallet: read" on public.smart_coin_wallets;
create policy "own smart coin wallet: read" on public.smart_coin_wallets for select using (user_id = auth.uid());
drop policy if exists "own smart coin ledger: read" on public.smart_coin_ledger;
create policy "own smart coin ledger: read" on public.smart_coin_ledger for select using (user_id = auth.uid());

-- Atomic balance change. With p_allow_negative = false a debit that would go below zero changes nothing and
-- returns null (not enough coins). Returns the new balance.
create or replace function public.adjust_smart_coins(p_user uuid, p_delta integer, p_reason text, p_ref text default '', p_label text default '', p_allow_negative boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  insert into smart_coin_wallets (user_id, balance) values (p_user, 0) on conflict (user_id) do nothing;
  update smart_coin_wallets
     set balance = balance + p_delta, updated_at = now()
   where user_id = p_user and (p_allow_negative or balance + p_delta >= 0)
  returning balance into new_balance;
  if new_balance is null then
    return null;
  end if;
  insert into smart_coin_ledger (user_id, delta, reason, ref, label) values (p_user, p_delta, p_reason, p_ref, p_label);
  return new_balance;
end;
$$;
revoke all on function public.adjust_smart_coins(uuid, integer, text, text, text, boolean) from public, anon, authenticated;
