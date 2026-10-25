-- «لأجل المهدي»: «تطوّر وازدهر» (what the person intends to achieve) and the planner (events and times that are
-- written inside the calendar's day squares, once or repeating weekly / monthly). Private: each person reads and
-- writes only their own rows, through their own session. Safe to run twice.

create table if not exists public.mahdi_grow_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  horizon text not null default 'month' check (horizon in ('week', 'month', 'year', 'someday')),
  note text not null default '' check (char_length(note) <= 400),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mahdi_grow_items_user_idx on public.mahdi_grow_items (user_id, created_at);

create table if not exists public.mahdi_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  day date not null,
  start_time text check (start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text check (end_time is null or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  repeat text not null default 'none' check (repeat in ('none', 'weekly', 'monthly')),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists mahdi_plan_items_user_idx on public.mahdi_plan_items (user_id, day);

alter table public.mahdi_grow_items enable row level security;
alter table public.mahdi_plan_items enable row level security;

do $$ begin
  create policy mahdi_grow_items_own on public.mahdi_grow_items
    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy mahdi_plan_items_own on public.mahdi_plan_items
    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

grant select, insert, update, delete on public.mahdi_grow_items to authenticated;
grant select, insert, update, delete on public.mahdi_plan_items to authenticated;
