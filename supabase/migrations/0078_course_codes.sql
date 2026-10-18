-- A course's price before the discount (shown struck through) and its discount codes: anyone who enters a code on that course's page pays the code's price.
alter table public.learn_courses add column if not exists was_sar integer check (was_sar is null or was_sar between 1 and 100000);

create table if not exists public.learn_codes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.learn_courses (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9_-]{2,40}$'),
  price_sar integer not null check (price_sar between 1 and 100000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (course_id, code)
);
alter table public.learn_codes enable row level security;
revoke all on public.learn_codes from anon, authenticated;

alter table public.course_orders add column if not exists code text not null default '';
