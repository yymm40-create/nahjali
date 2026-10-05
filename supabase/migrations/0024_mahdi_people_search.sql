-- «لأجل المهدي» · finding each other: every person of the app can be found by name or username, unless they locked
-- their account (private account) — nobody has to opt in. The search is forgiving: the first letters are enough,
-- Arabic letter forms and diacritics don't matter (أ/إ/آ = ا, ة = ه, ى = ي), and small typos still find the person.
-- Family members' accounts (children added by a parent) are never listed.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run (after 0023). Safe to run again.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- Lower case, one form per Arabic letter, no diacritics, tatweel or extra spaces, no @ in front
create or replace function public.mahdi_norm(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(
      translate(lower(coalesce(p, '')), 'أإآٱةىؤئ', 'ااااهيوي'),
      '[ًٌٍَُِّْٰـ@]', '', 'g'),
    '\s+', ' ', 'g'));
$$;

-- People matching a query, best first. Server only (the server adds pictures and follow states).
create or replace function public.mahdi_search_people(p_q text, p_me uuid, p_limit integer default 20)
returns table (user_id uuid, username text, display_name text, avatar_path text, show_avatar boolean, score real)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with q as (select replace(replace(public.mahdi_norm(p_q), '%', ''), '_', '') as n),
  people as (
    select p.user_id, u.username, p.display_name, p.avatar_path, coalesce(pr.show_avatar, false) as show_avatar,
           public.mahdi_norm(u.username) as nu, public.mahdi_norm(p.display_name) as nd
    from public.mahdi_profiles p
    left join public.site_usernames u on u.user_id = p.user_id
    left join public.mahdi_privacy pr on pr.user_id = p.user_id
    where p.user_id <> p_me
      and not coalesce(pr.private_account, false)
      and not exists (select 1 from public.mahdi_family f where f.member_id = p.user_id)
  ),
  scored as (
    select people.*,
      (case
        when nu = q.n then 100
        when nu like q.n || '%' then 85
        when nd = q.n then 80
        when nd like q.n || '%' then 75
        when nd like '% ' || q.n || '%' then 65
        when nu like '%' || q.n || '%' or nd like '%' || q.n || '%' then 50
        else 40 * greatest(word_similarity(q.n, coalesce(nu, '')), word_similarity(q.n, nd))
      end)::real as score
    from people, q
    where char_length(q.n) >= 1
      and (nu like '%' || q.n || '%' or nd like '%' || q.n || '%'
           or (char_length(q.n) >= 3 and greatest(word_similarity(q.n, coalesce(nu, '')), word_similarity(q.n, nd)) >= 0.4))
  )
  select user_id, username, display_name, avatar_path, show_avatar, score
  from scored
  order by score desc, char_length(display_name), display_name
  limit least(greatest(coalesce(p_limit, 20), 1), 30);
$$;
revoke all on function public.mahdi_search_people(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.mahdi_search_people(text, uuid, integer) to service_role;
