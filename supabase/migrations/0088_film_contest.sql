-- «مسابقة الفيلم السينمائي»: a page reached only by its link (/jawad-ai/contest). Each person sees the videos they made
-- in the cinematic film maker and adds the ones they want to the contest («أضف إلى المنصة»). The owner — and the
-- judges the owner adds — see every participant's file (their character sheets and videos) and every entry grouped by
-- person, and pick the 1st, 2nd and 3rd places, which then show on the site. Server only (service role).
create table if not exists public.contest_entries (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null unique references public.film_assets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.film_projects (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists contest_entries_user_idx on public.contest_entries (user_id, created_at);
alter table public.contest_entries enable row level security;
revoke all on public.contest_entries from anon, authenticated;

create table if not exists public.contest_judges (
  email text primary key check (email = lower(email) and char_length(email) <= 254),
  created_at timestamptz not null default now()
);
alter table public.contest_judges enable row level security;
revoke all on public.contest_judges from anon, authenticated;

create table if not exists public.contest_winners (
  place integer primary key check (place between 1 and 3),
  asset_id uuid not null references public.film_assets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  set_at timestamptz not null default now()
);
alter table public.contest_winners enable row level security;
revoke all on public.contest_winners from anon, authenticated;
