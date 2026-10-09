-- «دورة الجواد الذكي»: the course sold from /jawad-ai/course by bank transfer. The owner's settings (the clock of the three prices,
-- the prices, the page's words, the bank data, the group link) live in ONE row; every order a person starts is a row that goes
-- started → transferred («تم التحويل») → confirmed (the owner saw the money; the gift of زهرات is granted once) or rejected.
-- Server-only (RLS on, nothing granted): the pages talk to it through the API. Safe to run more than once.

create table if not exists public.course_settings (
  id integer primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.course_settings enable row level security;
revoke all on public.course_settings from anon, authenticated;

create table if not exists public.course_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null default '',
  name text not null default '' check (char_length(name) <= 120),
  phone text not null default '' check (char_length(phone) <= 30),
  product text not null check (product in ('combo', 'live', 'recorded')),
  -- the price phase it was started in (A: first day, B: second day, C: after)
  phase text not null check (phase in ('A', 'B', 'C')),
  amount_sar integer not null check (amount_sar >= 0),
  was_sar integer not null default 0,
  -- the gift (زهرات = riyals of balance) that comes with it
  bonus_sar integer not null default 0 check (bonus_sar >= 0),
  status text not null default 'started' check (status in ('started', 'transferred', 'confirmed', 'rejected')),
  -- the price a person saw is kept until this moment
  locked_until timestamptz not null,
  transferred_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by text,
  bonus_granted_at timestamptz,
  note text not null default '' check (char_length(note) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists course_orders_user_idx on public.course_orders (user_id, created_at desc);
create index if not exists course_orders_status_idx on public.course_orders (status, created_at desc);
alter table public.course_orders enable row level security;
revoke all on public.course_orders from anon, authenticated;
