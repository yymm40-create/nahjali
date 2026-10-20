-- «لأجل المهدي»: strategic goals («هدف استراتيجي») and a colour for every habit.
--
-- A project is now either an ordinary project or a strategic goal. A goal is long-term and not counted; it keeps its
-- statement, purpose, horizon and obstacles in `goal`. Its milestones («أهداف مرحلية») ARE counted: a target per
-- period (a week, two weeks, a month, two months), each one usually the answer to an obstacle, with an if-then plan.
-- Habits hang under one milestone or stay general for the whole goal. Safe to run twice.

-- ───────────────────────── projects: kind + goal ─────────────────────────
alter table public.mahdi_projects
  add column if not exists kind text not null default 'project',
  add column if not exists goal jsonb;

do $$ begin
  alter table public.mahdi_projects add constraint mahdi_projects_kind_check check (kind in ('project', 'goal'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.mahdi_projects add constraint mahdi_projects_goal_check
    check (goal is null or (jsonb_typeof(goal) = 'object' and pg_column_size(goal) <= 20000));
exception when duplicate_object then null; end $$;

-- ───────────────────────── milestones ─────────────────────────
create table if not exists public.mahdi_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  -- the obstacle this milestone removes, and the if-then plan for it
  obstacle text not null default '' check (char_length(obstacle) <= 200),
  plan text not null default '' check (char_length(plan) <= 200),
  target numeric not null check (target > 0 and target <= 1000000),
  unit text not null default '' check (char_length(unit) <= 20),
  period text not null check (period in ('week', '2weeks', 'month', '2months')),
  starts_on date not null,
  done_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (project_id, user_id) references public.mahdi_projects (id, user_id) on delete cascade
);
create index if not exists mahdi_milestones_user_idx on public.mahdi_milestones (user_id, project_id, sort_order);
drop trigger if exists mahdi_milestones_touch_updated_at on public.mahdi_milestones;
create trigger mahdi_milestones_touch_updated_at
  before update on public.mahdi_milestones
  for each row execute function public.touch_updated_at();

-- What was done towards a milestone on a day (the day's total).
create table if not exists public.mahdi_milestone_logs (
  milestone_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  value numeric not null check (value >= 0 and value <= 1000000),
  primary key (milestone_id, log_date),
  foreign key (milestone_id, user_id) references public.mahdi_milestones (id, user_id) on delete cascade
);
create index if not exists mahdi_milestone_logs_user_idx on public.mahdi_milestone_logs (user_id, milestone_id);

-- ───────────────────────── habits: milestone + colour ─────────────────────────
alter table public.mahdi_habits
  add column if not exists milestone_id uuid,
  add column if not exists color text;

do $$ begin
  alter table public.mahdi_habits add constraint mahdi_habits_color_check check (color is null or color ~ '^[a-z0-9]{2,16}$');
exception when duplicate_object then null; end $$;
do $$ begin
  -- deleting a milestone keeps its habits (they become general habits of the goal)
  alter table public.mahdi_habits add constraint mahdi_habits_milestone_fk
    foreign key (milestone_id, user_id) references public.mahdi_milestones (id, user_id) on delete set null (milestone_id);
exception when duplicate_object then null; end $$;
create index if not exists mahdi_habits_milestone_idx on public.mahdi_habits (milestone_id) where milestone_id is not null;

-- ───────────────────────── access: own rows only ─────────────────────────
alter table public.mahdi_milestones enable row level security;
alter table public.mahdi_milestone_logs enable row level security;

drop policy if exists "mahdi milestones: own rows" on public.mahdi_milestones;
create policy "mahdi milestones: own rows" on public.mahdi_milestones
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "mahdi milestone logs: own rows" on public.mahdi_milestone_logs;
create policy "mahdi milestone logs: own rows" on public.mahdi_milestone_logs
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.mahdi_milestones, public.mahdi_milestone_logs from anon;
grant select, insert, update, delete on public.mahdi_milestones, public.mahdi_milestone_logs to authenticated;

notify pgrst, 'reload schema';
