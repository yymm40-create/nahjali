-- «مراقبة الأكواد»: what an account that pays nothing (an «بلا حدود» code, the owner) used, and what it WOULD have
-- cost at the site's prices — so the owner sees every code user's spending, even when nothing leaves a wallet.
-- Written by the server only (service role); one row per operation (a robot's reply, a job, an editor tool).
create table if not exists public.site_free_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ref text not null default '',
  label text not null default '',
  halalas integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists site_free_usage_user_idx on public.site_free_usage (user_id, created_at desc);
create index if not exists site_free_usage_ref_idx on public.site_free_usage (ref);
alter table public.site_free_usage enable row level security;
revoke all on public.site_free_usage from anon, authenticated;
