-- «النقود الذكية» in riyals: the wallet unit becomes the halala (1 riyal = 100 halalas), «بلا حدود» marks on «السماح»
-- and on the codes, and the old owner-set prices move to the new unit. Safe to run more than once: the unit conversion
-- happens only the first time (a marker row in film_limits remembers it). A table that does not exist yet on this
-- database (e.g. the team wallets of 0033) is simply skipped.

-- 1. «♾️ بلا حدود»: nothing is charged to this e-mail / to whoever enters by this code
do $$
begin
  if to_regclass('public.site_access') is not null then
    alter table public.site_access add column if not exists unlimited boolean not null default false;
  end if;
  if to_regclass('public.site_codes') is not null then
    alter table public.site_codes add column if not exists unlimited boolean not null default false;
  end if;
end $$;

-- 2. the owner-set prices: now riyal COST in hundredths of a halala — wider range
do $$
begin
  if to_regclass('public.jawad_price_rules') is not null then
    alter table public.jawad_price_rules drop constraint if exists jawad_price_rules_centicoins_check;
    alter table public.jawad_price_rules add constraint jawad_price_rules_centicoins_check check (centicoins between 1 and 1000000000);
  end if;
end $$;

-- 3. one-time conversion of the old units (1 old coin = 0.25 riyal = 25 halalas); all or nothing
do $$
begin
  if to_regclass('public.film_limits') is null then
    raise notice 'film_limits is missing: run 0014_film_limits.sql first';
    return;
  end if;
  if not exists (select 1 from public.film_limits where scope = 'all' and target = '' and key = 'units_halalas') then
    if to_regclass('public.smart_coin_wallets') is not null then update public.smart_coin_wallets set balance = balance * 25; end if;
    if to_regclass('public.smart_coin_ledger')  is not null then update public.smart_coin_ledger  set delta = delta * 25; end if;
    if to_regclass('public.team_coin_wallets')  is not null then update public.team_coin_wallets  set balance = balance * 25; end if;
    if to_regclass('public.team_coin_ledger')   is not null then update public.team_coin_ledger   set delta = delta * 25; end if;
    if to_regclass('public.jawad_jobs')         is not null then update public.jawad_jobs         set price_coins = price_coins * 25; end if;
    -- an owner-set price was the selling price in hundredths of a coin; it is now the cost in hundredths of a halala
    if to_regclass('public.jawad_price_rules')  is not null then update public.jawad_price_rules  set centicoins = greatest(1, round(centicoins * 12.5)); end if;
    update public.film_limits set value = round(value * 12.5) where key like 'editor_price_%';
    insert into public.film_limits (scope, target, key, value, updated_at) values ('all', '', 'units_halalas', 1, now())
      on conflict (scope, target, key) do update set value = 1, updated_at = now();
  end if;
end $$;

-- 4. the site is paid from now on (the owner, the secret code and «بلا حدود» stay free)
insert into public.film_limits (scope, target, key, value, updated_at) values ('all', '', 'coins_required', 1, now())
  on conflict (scope, target, key) do update set value = 1, updated_at = now();
