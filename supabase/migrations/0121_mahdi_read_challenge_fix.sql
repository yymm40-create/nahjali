-- «لأجل المهدي» · «تحدي القراءة»: what counts, made right (the owner, 21 November 2026).
--   1. Pages a person says they read BEFORE (when they add a book they're already in) are kept apart:
--      mahdi_reading_sessions.earlier = true. They fill the book's page map only — never a day, a goal, a habit or the
--      challenge. The owner can also mark an old session as «earlier» from the challenge's breakdown.
--   2. What was missing is counted: pages logged in a «إخوة الولاية» group program habit or a «التحديات الموحدة»
--      challenge measured in pages; pages typed by hand into the habit linked to the reading goals (beyond what the
--      sessions put there); and any unit spelled with «صفح…» or «page…» («صفحات قرآن», «صفحة من كتاب»).
--   3. Narration books («رواية») are not pages: they don't count.
--   4. mahdi_read_challenge_detail(): every line of one member's count (counted or not, and why) for the breakdown.
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice. Needs 0120 first.

alter table public.mahdi_reading_sessions add column if not exists earlier boolean not null default false;

-- A unit that means pages
create or replace function public.mahdi_is_page_unit(u text)
returns boolean
language sql
immutable
as $$
  select coalesce(btrim(lower(u)) ~ '(صفح|page)' or btrim(lower(u)) in ('ص', 'ص.'), false);
$$;

-- Every line that could count for every member of a challenge, with whether it counts and why not.
-- Built here so a database without «إخوة الولاية» group programs (SQL 0083) or «التحديات الموحدة» (SQL 0008) still works:
-- their part is left out until their tables exist (run this file again after them).
do $do$
declare
  has_groups boolean := to_regclass('public.mahdi_group_habit_logs') is not null and to_regclass('public.mahdi_group_habits') is not null;
  has_chal boolean := to_regclass('public.mahdi_challenge_logs') is not null and to_regclass('public.mahdi_challenges') is not null;
  ctes text := '';
  tail text := '';
begin
  if has_groups then
    ctes := ctes || $grp$,
grp as (
  select l.user_id, l.log_date as day, 'group_habit'::text as source, l.habit_id as ref_id, gh.name, l.value as pages,
         null::jsonb as ranges, true as counted, null::text as why, l.updated_at as at
  from mahdi_group_habit_logs l
  join mahdi_group_habits gh on gh.id = l.habit_id and gh.group_id = l.group_id
  cross join c
  join lateral (
    select e->>'unit' as unit from jsonb_array_elements(gh.versions) e
    where (e->>'effectiveFrom') <= l.log_date::text
    order by e->>'effectiveFrom' desc limit 1
  ) v on true
  where l.user_id in (select user_id from m) and l.log_date between c.starts_on and c.ends_on and l.value > 0
    and mahdi_is_page_unit(v.unit)
)$grp$;
    tail := tail || ' union all select * from grp';
  end if;
  if has_chal then
    ctes := ctes || $chal$,
chal as (
  select l.user_id, l.log_date, 'challenge'::text, l.challenge_id, ch.title, l.value, null::jsonb, true, null::text, l.updated_at
  from mahdi_challenge_logs l
  join mahdi_challenges ch on ch.id = l.challenge_id
  cross join c
  where l.user_id in (select user_id from m) and l.log_date between c.starts_on and c.ends_on and l.value > 0
    and mahdi_is_page_unit(ch.unit)
)$chal$;
    tail := tail || ' union all select * from chal';
  end if;
  execute $fn$
create or replace function public.mahdi_read_challenge_rows(p_challenge uuid)
returns table (user_id uuid, day date, source text, ref_id uuid, title text, pages numeric, ranges jsonb, counted boolean, why text, at timestamptz)
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
-- «القارئ العلوي» sessions (timer, manual pages, in-app PDF)
sessions as (
  select s.user_id, s.log_date as day, 'book'::text as source, s.id as ref_id, b.title, s.pages_count::numeric as pages, s.ranges,
         (not s.earlier and b.unit = 'page') as counted,
         case when s.earlier then 'earlier' when b.unit <> 'page' then 'narration' end as why,
         s.created_at as at
  from mahdi_reading_sessions s
  join mahdi_books b on b.id = s.book_id
  cross join c
  where s.user_id in (select user_id from m) and s.log_date between c.starts_on and c.ends_on and s.pages_count > 0
),
-- pages of page-book sessions per person and day (all of them: before this fix «earlier» ones also reached the goal habit)
session_day as (
  select s.user_id, s.log_date as day, sum(s.pages_count)::numeric as pages
  from mahdi_reading_sessions s join mahdi_books b on b.id = s.book_id cross join c
  where s.user_id in (select user_id from m) and s.log_date between c.starts_on and c.ends_on and b.unit = 'page'
  group by 1, 2
),
-- my own habits measured in pages (the version in effect that day)
own as (
  select l.user_id, l.log_date as day, l.habit_id, h.name, l.value, l.updated_at, v.unit,
         (g.habit_id is not null) as goal_linked, g.habit_metric
  from mahdi_logs l
  join mahdi_habits h on h.id = l.habit_id
  cross join c
  join lateral (
    select v.unit from mahdi_habit_versions v
    where v.habit_id = l.habit_id and v.effective_from <= l.log_date
    order by v.effective_from desc limit 1
  ) v on true
  left join mahdi_reading_goals g on g.user_id = l.user_id and g.habit_id = l.habit_id
  where l.user_id in (select user_id from m) and l.log_date between c.starts_on and c.ends_on and l.value > 0
    and mahdi_is_page_unit(v.unit)
),
own_rows as (
  -- a habit of its own: all of it
  select o.user_id, o.day, 'habit'::text, o.habit_id, o.name, o.value, null::jsonb, true, null::text, o.updated_at
  from own o where not o.goal_linked
  union all
  -- the habit the reading sessions fill (in pages): only what was typed in by hand beyond the sessions
  select o.user_id, o.day, 'goal_habit'::text, o.habit_id, o.name,
         greatest(0, o.value - coalesce(sd.pages, 0)), null::jsonb, true, null::text, o.updated_at
  from own o left join session_day sd on sd.user_id = o.user_id and sd.day = o.day
  where o.goal_linked and o.habit_metric = 'pages' and o.value - coalesce(sd.pages, 0) > 0
)
$fn$ || ctes || $fn2$
select * from sessions
union all select * from own_rows$fn2$ || tail || $fn3$;
$$;$fn3$;
end
$do$;

revoke all on function public.mahdi_read_challenge_rows(uuid) from public, anon, authenticated;
grant execute on function public.mahdi_read_challenge_rows(uuid) to service_role;

-- Pages per member: the counted lines
create or replace function public.mahdi_read_challenge_pages(p_challenge uuid)
returns table (user_id uuid, pages bigint, days bigint)
language sql
stable
security definer
set search_path = public
as $$
with m as (select user_id from mahdi_read_challenge_members where challenge_id = p_challenge),
r as (select * from mahdi_read_challenge_rows(p_challenge) where counted and pages > 0)
select m.user_id, coalesce(floor(sum(r.pages)), 0)::bigint, count(distinct r.day)::bigint
from m left join r using (user_id)
group by m.user_id;
$$;
revoke all on function public.mahdi_read_challenge_pages(uuid) from public, anon, authenticated;
grant execute on function public.mahdi_read_challenge_pages(uuid) to service_role;

-- One member's breakdown, the newest first
create or replace function public.mahdi_read_challenge_detail(p_challenge uuid, p_user uuid)
returns table (day date, source text, ref_id uuid, title text, pages numeric, ranges jsonb, counted boolean, why text, at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.day, r.source, r.ref_id, r.title, r.pages, r.ranges, r.counted, r.why, r.at
  from mahdi_read_challenge_rows(p_challenge) r
  where r.user_id = p_user
  order by r.day desc, r.at desc;
$$;
revoke all on function public.mahdi_read_challenge_detail(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mahdi_read_challenge_detail(uuid, uuid) to service_role;
