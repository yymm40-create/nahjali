-- «لأجل المهدي» · «تحدي القراءة»: a page of a book counts ONCE (the owner, 22 November 2026).
-- Someone saved the same pages of one book 15 times in 45 minutes (9–166, 9–140, 9–127…) and every session was added
-- up: 1,543 pages for 290 real ones. Now a session of «القارئ العلوي» counts only the pages of that book the person had
-- never saved before — in an earlier session of the challenge, before the challenge, or as «قرأتها قبل». Read the same
-- pages again: nothing more. A session with no new page shows in the breakdown as «مكررة».
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice. Needs 0121 first.

do $do$
declare
  grp text := '';
  chal text := '';
  tail text := '';
begin
  if to_regclass('public.mahdi_group_habit_logs') is not null and to_regclass('public.mahdi_group_habits') is not null then
    grp := $g$,
grp as (
  select l.user_id, l.log_date as day, 'group_habit'::text as source, l.habit_id as ref_id, gh.name, l.value as pages,
         null::jsonb as ranges, true as counted, null::text as why, l.updated_at as at
  from mahdi_group_habit_logs l join mahdi_group_habits gh on gh.id = l.habit_id and gh.group_id = l.group_id cross join c
  join lateral (select e->>'unit' as unit from jsonb_array_elements(gh.versions) e where (e->>'effectiveFrom') <= l.log_date::text order by e->>'effectiveFrom' desc limit 1) v on true
  where l.user_id in (select user_id from m) and l.log_date between c.starts_on and c.ends_on and l.value > 0 and mahdi_is_page_unit(v.unit)
)$g$;
    tail := tail || ' union all select * from grp';
  end if;
  if to_regclass('public.mahdi_challenge_logs') is not null and to_regclass('public.mahdi_challenges') is not null then
    chal := $c$,
chal as (
  select l.user_id, l.log_date, 'challenge'::text, l.challenge_id, ch.title, l.value, null::jsonb, true, null::text, l.updated_at
  from mahdi_challenge_logs l join mahdi_challenges ch on ch.id = l.challenge_id cross join c
  where l.user_id in (select user_id from m) and l.log_date between c.starts_on and c.ends_on and l.value > 0 and mahdi_is_page_unit(ch.unit)
)$c$;
    tail := tail || ' union all select * from chal';
  end if;
  execute $fn$
create or replace function public.mahdi_read_challenge_rows(p_challenge uuid)
returns table (user_id uuid, day date, source text, ref_id uuid, title text, pages numeric, ranges jsonb, counted boolean, why text, at timestamptz)
language sql stable security definer set search_path = public as $$
with c as (select starts_on, ends_on from mahdi_read_challenges where id = p_challenge),
m as (select user_id from mahdi_read_challenge_members where challenge_id = p_challenge),
-- every page of every session of the members' books (up to the challenge's last day), one row each
page_rows as (
  select s.id, s.user_id, s.book_id, s.created_at, gs.page
  from mahdi_reading_sessions s cross join c
  cross join lateral jsonb_array_elements(s.ranges) r
  cross join lateral generate_series(greatest(1, (r->>0)::int), (r->>1)::int) gs(page)
  where s.user_id in (select user_id from m) and s.log_date <= c.ends_on and jsonb_typeof(r) = 'array'
),
-- the first session that ever saved each page of a book: only that one counts it
first_save as (
  select distinct on (user_id, book_id, page) id, page from page_rows order by user_id, book_id, page, created_at, id
),
new_pages as (select id, count(*)::numeric as n from first_save group by id),
sessions as (
  select s.user_id, s.log_date as day, 'book'::text as source, s.id as ref_id, b.title,
         case when s.earlier or b.unit <> 'page' then s.pages_count::numeric else coalesce(np.n, 0) end as pages, s.ranges,
         (not s.earlier and b.unit = 'page' and coalesce(np.n, 0) > 0) as counted,
         case when s.earlier then 'earlier' when b.unit <> 'page' then 'narration' when coalesce(np.n, 0) = 0 then 'repeat' end as why,
         s.created_at as at
  from mahdi_reading_sessions s join mahdi_books b on b.id = s.book_id cross join c
  left join new_pages np on np.id = s.id
  where s.user_id in (select user_id from m) and s.log_date between c.starts_on and c.ends_on and s.pages_count > 0
),
session_day as (
  select s.user_id, s.log_date as day, sum(s.pages_count)::numeric as pages
  from mahdi_reading_sessions s join mahdi_books b on b.id = s.book_id cross join c
  where s.user_id in (select user_id from m) and s.log_date between c.starts_on and c.ends_on and b.unit = 'page'
  group by 1, 2
),
own as (
  select l.user_id, l.log_date as day, l.habit_id, h.name, l.value, l.updated_at, (g.habit_id is not null) as goal_linked, g.habit_metric
  from mahdi_logs l join mahdi_habits h on h.id = l.habit_id cross join c
  join lateral (select v.unit from mahdi_habit_versions v where v.habit_id = l.habit_id and v.effective_from <= l.log_date order by v.effective_from desc limit 1) v on true
  left join mahdi_reading_goals g on g.user_id = l.user_id and g.habit_id = l.habit_id
  where l.user_id in (select user_id from m) and l.log_date between c.starts_on and c.ends_on and l.value > 0 and mahdi_is_page_unit(v.unit)
),
own_rows as (
  select o.user_id, o.day, 'habit'::text, o.habit_id, o.name, o.value, null::jsonb, true, null::text, o.updated_at from own o where not o.goal_linked
  union all
  select o.user_id, o.day, 'goal_habit'::text, o.habit_id, o.name, greatest(0, o.value - coalesce(sd.pages, 0)), null::jsonb, true, null::text, o.updated_at
  from own o left join session_day sd on sd.user_id = o.user_id and sd.day = o.day
  where o.goal_linked and o.habit_metric = 'pages' and o.value - coalesce(sd.pages, 0) > 0
)$fn$ || grp || chal || $fn2$
select * from sessions union all select * from own_rows$fn2$ || tail || $fn3$;
$$;$fn3$;
end
$do$;

revoke all on function public.mahdi_read_challenge_rows(uuid) from public, anon, authenticated;
grant execute on function public.mahdi_read_challenge_rows(uuid) to service_role;
