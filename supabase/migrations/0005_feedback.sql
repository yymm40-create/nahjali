-- Customer feedback (rating + comment), shown on the owner's dashboard.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  message text check (char_length(message) <= 1000),
  created_at timestamptz not null default now()
);
create index feedback_created_idx on public.feedback (created_at desc);

-- Written and read only through the server (service role)
alter table public.feedback enable row level security;
