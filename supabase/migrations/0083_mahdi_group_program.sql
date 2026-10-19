-- «لأجل المهدي» · «إخوة الولاية»: a group run like its own «لأجل المهدي».
--   1) Leaders under the leader: a member can be made a «مشرف» (admin) with chosen permissions, by the leader or by an
--      admin who holds «المشرفين» (who can hand on only what they hold themselves, and manage only those under them).
--   2) The group's own program: projects and habits built exactly like a person's own (measure, goal, frequency, days,
--      icon, colour…), each member logging them in their day like their own habits, and the leaders seeing every
--      member's numbers and comparing them.
-- Server-only like the rest of the groups (RLS on, nothing granted): the pages reach it through the API.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.

alter table public.mahdi_group_members add column if not exists role text not null default 'member';
alter table public.mahdi_group_members drop constraint if exists mahdi_group_members_role_check;
alter table public.mahdi_group_members add constraint mahdi_group_members_role_check check (role in ('member', 'admin'));
alter table public.mahdi_group_members add column if not exists perms text[] not null default '{}';
alter table public.mahdi_group_members add column if not exists appointed_by uuid references auth.users (id) on delete set null;

create table if not exists public.mahdi_group_projects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.mahdi_groups (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  icon text not null default '' check (char_length(icon) <= 16),
  color text not null default 'gold' check (color in ('gold', 'emerald', 'lapis', 'turquoise', 'garnet', 'amber', 'olive', 'stone')),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, group_id)
);
create index if not exists mahdi_group_projects_group_idx on public.mahdi_group_projects (group_id, sort_order);

-- a habit's goal history is kept on the habit (oldest first): [{ effectiveFrom, measure, target, unit, freq, days, state }]
create table if not exists public.mahdi_group_habits (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.mahdi_groups (id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  icon text not null default '' check (char_length(icon) <= 16),
  category text not null default '' check (char_length(category) <= 30),
  notes text not null default '' check (char_length(notes) <= 500),
  reminder_time time,
  sort_order integer not null default 0,
  versions jsonb not null default '[]'::jsonb check (jsonb_typeof(versions) = 'array'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, group_id),
  foreign key (project_id, group_id) references public.mahdi_group_projects (id, group_id) on delete cascade
);
create index if not exists mahdi_group_habits_group_idx on public.mahdi_group_habits (group_id, project_id, sort_order);

-- what each member logged: the day's total, the newest edit wins (like a person's own logs)
create table if not exists public.mahdi_group_habit_logs (
  habit_id uuid not null,
  group_id uuid not null,
  user_id uuid not null,
  log_date date not null,
  value numeric not null check (value >= 0 and value <= 1000000),
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (habit_id, user_id, log_date),
  foreign key (habit_id, group_id) references public.mahdi_group_habits (id, group_id) on delete cascade,
  foreign key (group_id, user_id) references public.mahdi_group_members (group_id, user_id) on delete cascade
);
create index if not exists mahdi_group_habit_logs_group_idx on public.mahdi_group_habit_logs (group_id, log_date);
create index if not exists mahdi_group_habit_logs_user_idx on public.mahdi_group_habit_logs (user_id, log_date);

alter table public.mahdi_group_projects enable row level security;
alter table public.mahdi_group_habits enable row level security;
alter table public.mahdi_group_habit_logs enable row level security;
revoke all on public.mahdi_group_projects from anon, authenticated;
revoke all on public.mahdi_group_habits from anon, authenticated;
revoke all on public.mahdi_group_habit_logs from anon, authenticated;
