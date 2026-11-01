-- «لأجل المهدي»: «خانة الطوارئ» (the emergency slot).
--
-- A counter or an amount habit may carry a SMALLER goal, `emergency_target`, for the days the person cannot do it in full.
-- On a day they choose («اليوم طوارئ») the day's goal is that smaller one; reaching it counts as the day's goal reached and is
-- shown in its own colour. `mahdi_emergency_days` keeps the days chosen, per habit, so the week and the month can say how many
-- emergency days and emergency habits there were. Safe to run twice.

alter table public.mahdi_habits
  add column if not exists emergency_target numeric;

do $$ begin
  alter table public.mahdi_habits add constraint mahdi_habits_emergency_target_check
    check (emergency_target is null or (emergency_target > 0 and emergency_target <= 1000000));
exception when duplicate_object then null; end $$;

create table if not exists public.mahdi_emergency_days (
  habit_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, day),
  foreign key (habit_id, user_id) references public.mahdi_habits (id, user_id) on delete cascade
);
create index if not exists mahdi_emergency_days_user_idx on public.mahdi_emergency_days (user_id, day);

alter table public.mahdi_emergency_days enable row level security;
drop policy if exists "mahdi emergency days: own rows" on public.mahdi_emergency_days;
create policy "mahdi emergency days: own rows" on public.mahdi_emergency_days
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.mahdi_emergency_days from anon;
grant select, insert, update, delete on public.mahdi_emergency_days to authenticated;

notify pgrst, 'reload schema';
