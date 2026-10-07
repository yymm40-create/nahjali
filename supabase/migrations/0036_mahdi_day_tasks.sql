-- «لأجل المهدي» · «مهام اليوم»: things to do today only (not a habit, not a schedule). Each can have a time (then a
-- notification reminds at that time, and again an hour later if it is still open) and can be tied to one of the
-- user's habits (ticking the task fills that habit for the day). The app works before this runs (no tasks shown).

create table if not exists public.mahdi_day_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_date date not null,
  title text not null check (char_length(title) between 1 and 200),
  -- «HH:MM» in the user's own time zone, or null for a plain checklist task
  at_time time,
  habit_id uuid references public.mahdi_habits (id) on delete set null,
  sort_order integer not null default 0,
  done_at timestamptz,
  -- reminders already sent for it: 0 none, 1 at its time, 2 the follow-up an hour later
  notified smallint not null default 0 check (notified between 0 and 2),
  created_at timestamptz not null default now()
);
create index if not exists mahdi_day_tasks_user_day_idx on public.mahdi_day_tasks (user_id, task_date);
-- the dispatcher looks for timed tasks still open
create index if not exists mahdi_day_tasks_open_idx on public.mahdi_day_tasks (task_date) where done_at is null and at_time is not null and notified < 2;

alter table public.mahdi_day_tasks enable row level security;
drop policy if exists "mahdi day tasks: own rows" on public.mahdi_day_tasks;
create policy "mahdi day tasks: own rows" on public.mahdi_day_tasks
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.mahdi_day_tasks from anon;
grant select, insert, update, delete on public.mahdi_day_tasks to authenticated;
