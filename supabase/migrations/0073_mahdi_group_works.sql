-- «لأجل المهدي» · أعمال المجموعة: the leader publishes one shared definition and every active member
-- follows it. Completion is per member; daily work gets a fresh completion each day, while one-time work
-- keeps one completion on its due date. These tables are server-only, like the rest of the private group data.

create table if not exists public.mahdi_group_works (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.mahdi_groups (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  details text not null default '' check (char_length(details) <= 500),
  cadence text not null default 'daily' check (cadence in ('daily', 'once')),
  due_date date,
  created_by uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, group_id),
  check ((cadence = 'daily' and due_date is null) or (cadence = 'once' and due_date is not null))
);
create index if not exists mahdi_group_works_group_idx
  on public.mahdi_group_works (group_id, active, created_at);
drop trigger if exists mahdi_group_works_touch_updated_at on public.mahdi_group_works;
create trigger mahdi_group_works_touch_updated_at
  before update on public.mahdi_group_works
  for each row execute function public.touch_updated_at();

create table if not exists public.mahdi_group_work_logs (
  work_id uuid not null,
  group_id uuid not null,
  user_id uuid not null,
  work_date date not null,
  done_at timestamptz not null default now(),
  primary key (work_id, user_id, work_date),
  foreign key (work_id, group_id) references public.mahdi_group_works (id, group_id) on delete cascade,
  foreign key (group_id, user_id) references public.mahdi_group_members (group_id, user_id) on delete cascade
);
create index if not exists mahdi_group_work_logs_group_day_idx
  on public.mahdi_group_work_logs (group_id, work_date);

alter table public.mahdi_group_works enable row level security;
alter table public.mahdi_group_work_logs enable row level security;

-- No direct policies: reads and writes go through the server after checking active membership and leadership.
revoke all on public.mahdi_group_works, public.mahdi_group_work_logs from anon, authenticated;
