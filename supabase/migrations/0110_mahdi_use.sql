-- «لأجل المهدي» · measuring how the app is used (the owner, 12 November 2026): which sections people open each day,
-- and the owner's numbers built on it — how many signed up, made a first habit, ticked a first «تم» (and how many in
-- their first session), who came back the next day, after a week and after a month (by signup week), and how many
-- use each section. Only the owner's page reads the numbers (through the server); nobody sees anyone else's rows.
--   · mahdi_use_days — one row per person, day and section they opened (no times, no pages, no content).
--   · mahdi_admin_metrics() — the owner's numbers as one JSON (callable by the server only).
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice.

create table if not exists public.mahdi_use_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  area text not null check (area ~ '^[a-z0-9-]{1,30}$'),
  first_at timestamptz not null default now(),
  primary key (user_id, day, area)
);
create index if not exists mahdi_use_days_day_idx on public.mahdi_use_days (day);

alter table public.mahdi_use_days enable row level security;
drop policy if exists "mahdi use days: own rows" on public.mahdi_use_days;
create policy "mahdi use days: own rows" on public.mahdi_use_days
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.mahdi_use_days from anon;
grant select, insert on public.mahdi_use_days to authenticated;

-- A day someone was "active": they opened the app (use days) or logged a habit (works for the time before this file too)
create or replace function public.mahdi_admin_metrics()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with p as (
  select user_id, created_at, (created_at at time zone time_zone)::date as d0 from mahdi_profiles
),
active as (
  select user_id, day from mahdi_use_days
  union
  select user_id, log_date from mahdi_logs
),
first_log as (
  select user_id, min(updated_at) as at from mahdi_logs group by user_id
),
funnel as (
  select
    count(*) as signed_up,
    count(*) filter (where exists (select 1 from mahdi_habits h where h.user_id = p.user_id)) as made_habit,
    count(*) filter (where f.at is not null) as first_check,
    count(*) filter (where f.at is not null and f.at <= p.created_at + interval '30 minutes') as first_check_first_session
  from p left join first_log f using (user_id)
),
cohorts as (
  select
    date_trunc('week', p.d0)::date as week,
    count(*) as size,
    count(*) filter (where p.d0 + 1 <= current_date) as size_d1,
    count(*) filter (where p.d0 + 7 <= current_date) as size_d7,
    count(*) filter (where p.d0 + 30 <= current_date) as size_d30,
    count(*) filter (where exists (select 1 from active a where a.user_id = p.user_id and a.day = p.d0 + 1)) as d1,
    count(*) filter (where exists (select 1 from active a where a.user_id = p.user_id and a.day = p.d0 + 7)) as d7,
    count(*) filter (where exists (select 1 from active a where a.user_id = p.user_id and a.day = p.d0 + 30)) as d30
  from p
  where p.d0 >= current_date - 7 * 16
  group by 1
),
areas as (
  select area,
    count(distinct user_id) filter (where day > current_date - 7) as users7,
    count(distinct user_id) filter (where day > current_date - 30) as users30
  from mahdi_use_days
  where day > current_date - 30
  group by area
),
daily as (
  select day, count(distinct user_id) as users from active where day > current_date - 30 and day <= current_date group by day
)
select jsonb_build_object(
  'funnel', (select to_jsonb(funnel) from funnel),
  'active', jsonb_build_object(
    'day', (select count(distinct user_id) from active where day = current_date),
    'week', (select count(distinct user_id) from active where day > current_date - 7 and day <= current_date),
    'month', (select count(distinct user_id) from active where day > current_date - 30 and day <= current_date)
  ),
  'cohorts', coalesce((select jsonb_agg(to_jsonb(c) order by c.week desc) from cohorts c), '[]'::jsonb),
  'areas', coalesce((select jsonb_agg(to_jsonb(x) order by x.users30 desc) from areas x), '[]'::jsonb),
  'daily', coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from daily d), '[]'::jsonb),
  'since', (select min(day) from mahdi_use_days)
);
$$;
revoke all on function public.mahdi_admin_metrics() from public, anon, authenticated;
grant execute on function public.mahdi_admin_metrics() to service_role;
