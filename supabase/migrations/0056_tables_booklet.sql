-- «كتيب الجداول الذكي» (JAWAD AI): the booklet of tables back, for a child or a grown-up. Its conversations with «نور»
-- (who designs the tables with the person), and the design a booklet order is made from (orders.spec: who it is for,
-- the tables, how each is scored, the look, with or without the person's picture). Server-only (RLS on, nothing granted).

alter table public.orders add column if not exists spec jsonb;

create table if not exists public.booklet_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  -- who the booklet is for: { kind: child|adult, gender: male|female, age, name }
  audience jsonb not null default '{}'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  -- the design «نور» last wrote (the tables, the scoring, the look), ready to be made
  spec jsonb,
  order_id uuid references public.orders (id) on delete set null,
  usd numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists booklet_chats_user_idx on public.booklet_chats (user_id, updated_at desc);
alter table public.booklet_chats enable row level security;
revoke all on public.booklet_chats from anon, authenticated;
