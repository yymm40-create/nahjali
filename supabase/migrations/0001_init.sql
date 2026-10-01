-- Initial schema for the habits booklet app.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.
--
-- Access model: the browser can only READ its own rows (RLS below).
-- All writes go through our server routes using the service-role key,
-- which bypasses RLS after the server has checked ownership itself.

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- Create a profile automatically for every new auth user
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── orders ─────────────────────────
create type public.order_status as enum (
  'pending_payment', 'paid', 'generating_character', 'awaiting_approval',
  'generating_poses', 'composing', 'ready', 'failed'
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id text not null,
  status public.order_status not null default 'pending_payment',
  amount_halalas integer not null check (amount_halalas > 0),
  moyasar_payment_id text unique,
  attempts_allowed integer not null default 3,
  attempts_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_id_idx on public.orders (user_id);

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- ───────────────────────── characters ─────────────────────────
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  source_image_path text not null,
  base_image_path text,
  attempt_number integer not null,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);
create index characters_order_id_idx on public.characters (order_id);
-- At most one approved character per order
create unique index characters_one_approved_idx on public.characters (order_id) where is_approved;

-- ───────────────────────── poses ─────────────────────────
create type public.pose_status as enum ('pending', 'done', 'failed');

create table public.poses (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  pose_key text not null,
  image_path text,
  status public.pose_status not null default 'pending',
  -- Not in the original spec: needed for "retry at most twice" and to stop
  -- two browser tabs generating the same pose at once.
  attempts integer not null default 0,
  started_at timestamptz,
  unique (character_id, pose_key)
);

-- ───────────────────────── booklets ─────────────────────────
create table public.booklets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  pdf_path text not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── generation_logs ─────────────────────────
create table public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  type text not null check (type in ('character', 'pose')),
  model text not null,
  quality text not null,
  estimated_cost_usd numeric(10, 4) not null default 0,
  success boolean not null,
  error text,
  created_at timestamptz not null default now()
);
create index generation_logs_order_created_idx on public.generation_logs (order_id, created_at);

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.characters enable row level security;
alter table public.poses enable row level security;
alter table public.booklets enable row level security;
alter table public.generation_logs enable row level security;

create policy "own profile: read" on public.profiles
  for select using (id = auth.uid());
create policy "own profile: update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "own orders: read" on public.orders
  for select using (user_id = auth.uid());

create policy "own characters: read" on public.characters
  for select using (exists (
    select 1 from public.orders o where o.id = characters.order_id and o.user_id = auth.uid()
  ));

create policy "own poses: read" on public.poses
  for select using (exists (
    select 1 from public.characters c join public.orders o on o.id = c.order_id
    where c.id = poses.character_id and o.user_id = auth.uid()
  ));

create policy "own booklets: read" on public.booklets
  for select using (exists (
    select 1 from public.orders o where o.id = booklets.order_id and o.user_id = auth.uid()
  ));

-- generation_logs: no policies → not readable from the browser at all (server only)

-- ───────────────────────── Storage (private buckets) ─────────────────────────
-- No storage policies are added, so only the server (service role) can read/write.
-- Users get short-lived signed URLs from the server.
insert into storage.buckets (id, name, public) values
  ('sources', 'sources', false),
  ('generated', 'generated', false),
  ('booklets', 'booklets', false);
