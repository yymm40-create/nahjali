-- The owner's statistics (/admin/stats): who opened which page of the site. A visitor is a random id kept on their device
-- (no name, no IP); the account too when signed in. Server-only (RLS on, nothing granted).

create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  visitor text not null check (char_length(visitor) between 8 and 64),
  user_id uuid references auth.users (id) on delete set null,
  path text not null check (char_length(path) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists site_visits_time_idx on public.site_visits (created_at desc);
create index if not exists site_visits_path_idx on public.site_visits (path, created_at desc);
alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;
