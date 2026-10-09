-- «النقود الذكية» in riyals: the wallet unit becomes the halala (1 riyal = 100 halalas), «بلا حدود» marks on «السماح»
-- and on the codes, and the old owner-set prices move to the new unit. Safe to run more than once: the unit conversion
-- happens only the first time (a marker row in film_limits remembers it).

-- 1. «♾️ بلا حدود»: nothing is charged to this e-mail / to whoever enters by this code
alter table public.site_access add column if not exists unlimited boolean not null default false;
alter table public.site_codes  add column if not exists unlimited boolean not null default false;

-- 2. the editor's prices: now riyal COST in halalas (the margin is added on top when charging) — wider range
alter table public.jawad_price_rules drop constraint if exists jawad_price_rules_centicoins_check;
alter table public.jawad_price_rules add constraint jawad_price_rules_centicoins_check check (centicoins between 1 and 1000000000);

-- 3. one-time conversion of the old units (1 old coin = 0.25 riyal = 25 halalas)
do $$
begin
  if not exists (select 1 from public.film_limits where scope = 'all' and target = '' and key = 'units_halalas') then
    update public.smart_coin_wallets set balance = balance * 25;
    update public.smart_coin_ledger  set delta = delta * 25;
    update public.team_coin_wallets  set balance = balance * 25;
    update public.team_coin_ledger   set delta = delta * 25;
    update public.jawad_jobs         set price_coins = price_coins * 25;
    -- an owner-set price was the selling price in hundredths of a coin; it is now the cost in hundredths of a halala
    update public.jawad_price_rules  set centicoins = greatest(1, round(centicoins * 12.5));
    update public.film_limits        set value = round(value * 12.5) where key like 'editor_price_%';
    insert into public.film_limits (scope, target, key, value, updated_at) values ('all', '', 'units_halalas', 1, now())
      on conflict (scope, target, key) do update set value = 1, updated_at = now();
  end if;
end $$;

-- 4. the site is paid from now on (the owner, the secret code and «بلا حدود» stay free)
insert into public.film_limits (scope, target, key, value, updated_at) values ('all', '', 'coins_required', 1, now())
  on conflict (scope, target, key) do update set value = 1, updated_at = now();
