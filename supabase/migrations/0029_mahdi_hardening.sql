-- «لأجل المهدي» hardening (site audit, October 2026). Run once in Supabase: Dashboard → SQL Editor → paste → Run.
-- Safe to run again. The website's own checks stay as they are; these make the database refuse what a person's own
-- key could otherwise write past them (rankings and rewards are shared, so they must be fair).

-- 1) Reading sessions written with a person's own key follow the website's rules: a timed session is no longer than
--    the time since it started (a little slack), a manual entry is within the last 60 days, and one day never holds
--    more than 24 hours of reading. The server (service role) is trusted.
create or replace function public.mahdi_reading_session_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  total integer;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.started_at is not null then
    if new.started_at > now() + interval '1 minute' or new.started_at < now() - interval '3 days' then
      raise exception 'invalid session start' using errcode = '42501';
    end if;
    if new.seconds > extract(epoch from (now() - new.started_at)) + 120 then
      raise exception 'session longer than the time since it started' using errcode = '42501';
    end if;
  elsif new.log_date > current_date + 1 or new.log_date < current_date - 60 then
    raise exception 'invalid session date' using errcode = '42501';
  end if;
  select coalesce(sum(seconds), 0) into total
    from public.mahdi_reading_sessions
   where user_id = new.user_id and log_date = new.log_date and (tg_op = 'INSERT' or id <> new.id);
  if total + new.seconds > 86400 then
    raise exception 'more than a day of reading in one day' using errcode = '42501';
  end if;
  return new;
end
$$;
drop trigger if exists mahdi_reading_session_guard on public.mahdi_reading_sessions;
create trigger mahdi_reading_session_guard before insert or update on public.mahdi_reading_sessions
  for each row execute function public.mahdi_reading_session_guard();

-- 2) Challenge logs only inside the person's own membership window and the challenge's dates (the website's rule),
--    so nobody back-fills a challenge to the top of its ranking.
create or replace function public.mahdi_challenge_log_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  m record;
  c record;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  select joined_on, left_on into m from public.mahdi_challenge_members where challenge_id = new.challenge_id and user_id = new.user_id;
  if not found then
    raise exception 'not a member' using errcode = '42501';
  end if;
  select starts_on, ends_on into c from public.mahdi_challenges where id = new.challenge_id;
  if new.log_date < greatest(m.joined_on, c.starts_on) or new.log_date > current_date + 1
     or (m.left_on is not null and new.log_date > m.left_on) or (c.ends_on is not null and new.log_date > c.ends_on) then
    raise exception 'outside the challenge window' using errcode = '42501';
  end if;
  return new;
end
$$;
drop trigger if exists mahdi_challenge_log_guard on public.mahdi_challenge_logs;
create trigger mahdi_challenge_log_guard before insert or update on public.mahdi_challenge_logs
  for each row execute function public.mahdi_challenge_log_guard();

-- 3) Rewards one has to earn (the frame, the look variant, the view) are written only by the server, which checks
--    them (src/app/api/mahdi/profile/route.ts). The person's own key keeps the ordinary settings.
revoke update on public.mahdi_profiles from authenticated;
grant update (display_name, shrine_id, theme, time_zone, week_start, show_hijri, hijri_offset, updated_at) on public.mahdi_profiles to authenticated;

-- 4) Reactions are listed only on posts the reader may see (like comments), not on every post of every account.
drop policy if exists "mahdi reactions: read all, write own" on public.mahdi_post_reactions;
drop policy if exists "mahdi reactions: read on posts I can see" on public.mahdi_post_reactions;
create policy "mahdi reactions: read on posts I can see" on public.mahdi_post_reactions
  for select to authenticated using (exists (select 1 from public.mahdi_posts p where p.id = post_id));

-- 5) A ceiling per day on feedback and assistant questions written with a person's own key (the website allows
--    fewer; this stops a flood that skips the website).
create or replace function public.mahdi_daily_insert_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n integer;
  cap integer := tg_argv[0]::integer;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  execute format('select count(*) from %I.%I where user_id = $1 and created_at > now() - interval ''1 day''', tg_table_schema, tg_table_name) into n using new.user_id;
  if n >= cap then
    raise exception 'daily limit reached' using errcode = '42501';
  end if;
  return new;
end
$$;
drop trigger if exists mahdi_feedback_daily_guard on public.mahdi_feedback;
create trigger mahdi_feedback_daily_guard before insert on public.mahdi_feedback
  for each row execute function public.mahdi_daily_insert_guard('20');
drop trigger if exists mahdi_assistant_daily_guard on public.mahdi_assistant_messages;
create trigger mahdi_assistant_daily_guard before insert on public.mahdi_assistant_messages
  for each row execute function public.mahdi_daily_insert_guard('60');

notify pgrst, 'reload schema';
