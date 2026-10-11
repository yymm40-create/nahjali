-- «لأجل المهدي» · «الصحة العلوية» · the tracker: one row per person per day — every set of every exercise (weight ×
-- reps), cardio minutes, the day's nutrition and a weigh-in. The page works before this runs (kept on the device).

create table if not exists public.mahdi_health_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.mahdi_health_days enable row level security;
drop policy if exists "mahdi health days: own rows" on public.mahdi_health_days;
create policy "mahdi health days: own rows" on public.mahdi_health_days
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.mahdi_health_days from anon;
grant select, insert, update, delete on public.mahdi_health_days to authenticated;
