-- «التحكم بالموارد والمحاولات»: limits the owner sets from /admin/limits.
-- One row per (scope, target, key): scope 'all' (target ''), 'email' (target = the email), or 'plan' (target = plan key, later).
-- A missing row falls back to the next scope (email → plan → all → the default in the code).
create table if not exists public.film_limits (
  scope text not null check (scope in ('all', 'email', 'plan')),
  target text not null default '',
  key text not null,
  value integer not null check (value >= 0 and value <= 100000),
  updated_at timestamptz not null default now(),
  primary key (scope, target, key)
);

-- Written and read by the server only (service role); no browser access
alter table public.film_limits enable row level security;
