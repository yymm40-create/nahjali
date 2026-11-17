-- «لأجل المهدي» · «تحدي القراءة» (the owner, 17 November 2026; starts 18 November): 7 days exactly, whoever reads the most pages wins.
-- What counts is what people already record, from the challenge's first day (late joiners keep their earlier days):
--   · pages of reading sessions in «القارئ العلوي» (in-app PDF reading included), and
--   · the day's value of any habit measured in pages («صفحة / صفحات») — except the habit linked to the reading goals,
--     which the sessions already fill (counted once, not twice).
-- Joining is one tap with consent: the person agrees to show their name and pages in the list everyone sees.
--   · mahdi_read_challenges         — the challenge (title, first and last day). Closed to clients.
--   · mahdi_read_challenge_members  — who joined. Closed to clients; the server reads and writes it.
--   · mahdi_read_challenge_pages()  — pages per member (callable by the server only).
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice.

create table if not exists public.mahdi_read_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 60)
);

create table if not exists public.mahdi_read_challenge_members (
  challenge_id uuid not null references public.mahdi_read_challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index if not exists mahdi_read_challenge_members_user_idx on public.mahdi_read_challenge_members (user_id);

alter table public.mahdi_read_challenges enable row level security;
alter table public.mahdi_read_challenge_members enable row level security;
revoke all on public.mahdi_read_challenges from anon, authenticated;
revoke all on public.mahdi_read_challenge_members from anon, authenticated;

-- The first challenge: 18 → 24 November 2026 (7 days), each person's own local dates
insert into public.mahdi_read_challenges (id, title, starts_on, ends_on)
values ('7e5d0a11-0c1a-4d2e-9b7a-17112026a001', 'تحدي القراءة', '2026-11-18', '2026-11-24')
on conflict (id) do nothing;

create or replace function public.mahdi_read_challenge_pages(p_challenge uuid)
returns table (user_id uuid, pages bigint, days bigint)
language sql
stable
security definer
set search_path = public
as $$
with c as (
  select starts_on, ends_on from mahdi_read_challenges where id = p_challenge
),
m as (
  select user_id from mahdi_read_challenge_members where challenge_id = p_challenge
),
sessions as (
  select s.user_id, s.log_date as day, s.pages_count::numeric as pages
  from mahdi_reading_sessions s, c
  where s.user_id in (select user_id from m) and s.log_date between c.starts_on and c.ends_on and s.pages_count > 0
),
-- habits measured in pages on that day (the version in effect then), minus the one the reading sessions fill
page_habits as (
  select l.user_id, l.log_date as day, l.value as pages
  from mahdi_logs l
  cross join c
  join lateral (
    select v.unit from mahdi_habit_versions v
    where v.habit_id = l.habit_id and v.effective_from <= l.log_date
    order by v.effective_from desc limit 1
  ) v on true
  left join mahdi_reading_goals g on g.user_id = l.user_id and g.habit_id = l.habit_id
  where l.user_id in (select user_id from m)
    and l.log_date between c.starts_on and c.ends_on
    and l.value > 0
    and g.habit_id is null
    and btrim(lower(v.unit)) in ('صفحة', 'صفحه', 'صفحات', 'ص', 'page', 'pages')
),
everything as (
  select * from sessions union all select * from page_habits
)
select m.user_id, coalesce(floor(sum(e.pages)), 0)::bigint as pages, count(distinct e.day)::bigint as days
from m left join everything e using (user_id)
group by m.user_id;
$$;
revoke all on function public.mahdi_read_challenge_pages(uuid) from public, anon, authenticated;
grant execute on function public.mahdi_read_challenge_pages(uuid) to service_role;
