-- «اشحن رصيدك»: every order to top up the balance by bank transfer. started (the bank data shown) → transferred («تم التحويل»: the owner's
-- Telegram buzzes) → confirmed (the owner saw the money: the balance is added ONCE, credited_at marks it) or rejected.
-- The packages themselves are the owner's settings (jawad_settings, key "credits"). Server-only (RLS on, nothing granted). Safe to run more than once.

create table if not exists public.credit_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null default '',
  name text not null default '' check (char_length(name) <= 120),
  phone text not null default '' check (char_length(phone) <= 30),
  pack_id text not null check (char_length(pack_id) between 1 and 24),
  pack_name text not null default '' check (char_length(pack_name) <= 40),
  price_sar integer not null check (price_sar > 0),
  credit_sar integer not null check (credit_sar > 0),
  status text not null default 'started' check (status in ('started', 'transferred', 'confirmed', 'rejected')),
  transferred_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by text,
  credited_at timestamptz,
  note text not null default '' check (char_length(note) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists credit_orders_user_idx on public.credit_orders (user_id, created_at desc);
create index if not exists credit_orders_status_idx on public.credit_orders (status, created_at desc);
alter table public.credit_orders enable row level security;
revoke all on public.credit_orders from anon, authenticated;
