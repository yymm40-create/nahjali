-- «النقود الذكية»: each wallet's subscription and automatic top-up preference.
-- Set by the server only (the subscription once payments are connected; the auto top-up from /coins).
alter table public.smart_coin_wallets
  add column if not exists plan text,                                  -- starter · creator · studio (null: none)
  add column if not exists plan_period text check (plan_period in ('monthly', 'yearly')),
  add column if not exists plan_renews boolean not null default true,  -- monthly: renew every month, or this month only
  add column if not exists plan_expires_at timestamptz,
  add column if not exists auto_topup boolean not null default false,  -- charge the saved card when the balance is low
  add column if not exists auto_topup_sar integer not null default 50;
