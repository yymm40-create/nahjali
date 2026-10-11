-- «لأجل المهدي» · «الصحة العلوية»: the person's health profile and their plan (training table + nutrition targets),
-- one row per person, so it follows them to every device. The page works before this runs (kept on the device only).

create table if not exists public.mahdi_health (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  plan jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.mahdi_health enable row level security;
drop policy if exists "mahdi health: own row" on public.mahdi_health;
create policy "mahdi health: own row" on public.mahdi_health
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.mahdi_health from anon;
grant select, insert, update, delete on public.mahdi_health to authenticated;
