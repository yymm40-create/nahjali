-- Security hardening (site audit, October 2026). Run once in Supabase: Dashboard → SQL Editor → paste → Run.
-- Safe to run again. The website keeps working before it is run (it falls back to the old checks).

-- 1) Family PIN: every wrong try is counted atomically BEFORE the PIN is compared, so many guesses sent at the same
--    moment can't all read "0 wrong tries" (at most `p_tries` comparisons per lock window). Returns the count of this
--    try, or null while the account is locked. Called only by the server (service role).
create or replace function public.mahdi_family_pin_try(p_parent uuid, p_tries integer, p_minutes integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.mahdi_family_settings s
     set failed = case when s.locked_until is not null and s.locked_until <= now() then 1 else coalesce(s.failed, 0) + 1 end,
         locked_until = case
           when (case when s.locked_until is not null and s.locked_until <= now() then 1 else coalesce(s.failed, 0) + 1 end) >= p_tries
             then now() + make_interval(mins => p_minutes)
           else null
         end
   where s.parent_id = p_parent
     and (s.locked_until is null or s.locked_until <= now())
  returning s.failed into n;
  return n;
end
$$;
revoke execute on function public.mahdi_family_pin_try(uuid, integer, integer) from public, anon, authenticated;

-- 2) Rewards: a person may only mark their own rewards as seen (not change which milestone a reward is for).
revoke update on public.mahdi_user_rewards from authenticated;
grant update (seen_at) on public.mahdi_user_rewards to authenticated;

-- 3) Challenge membership written with a person's own key: only published challenges, a real join date, and the
--    ranking only where the challenge has one and the person shares in the community (the website's own rules).
create or replace function public.mahdi_challenge_member_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  c record;
begin
  -- the server (service role) is trusted; only requests made with a person's own key are checked
  if current_user <> 'authenticated' then
    return new;
  end if;
  select status, leaderboard into c from public.mahdi_challenges where id = new.challenge_id;
  -- joining needs a published challenge (leaving or other changes on an archived one stay possible)
  if tg_op = 'INSERT' and (not found or c.status <> 'published') then
    raise exception 'challenge not open' using errcode = '42501';
  end if;
  if (tg_op = 'INSERT' or new.joined_on is distinct from old.joined_on)
     and (new.joined_on < current_date - 1 or new.joined_on > current_date + 1) then
    raise exception 'invalid join date' using errcode = '42501';
  end if;
  if new.on_leaderboard and (tg_op = 'INSERT' or not old.on_leaderboard) then
    if c.leaderboard is not true or not exists (select 1 from public.mahdi_privacy p where p.user_id = new.user_id and p.community) then
      raise exception 'ranking not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;
drop trigger if exists mahdi_challenge_member_guard on public.mahdi_challenge_members;
create trigger mahdi_challenge_member_guard before insert or update on public.mahdi_challenge_members
  for each row execute function public.mahdi_challenge_member_guard();

-- 4) Usernames written with a person's own key can't take a reserved name (same list as src/lib/username-rules.ts).
create or replace function public.site_username_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated' and lower(new.username) = any (array[
    'admin', 'administrator', 'mahdi', 'nahjali', 'support', 'help', 'root', 'system', 'owner', 'moderator', 'official',
    'api', 'www', 'null', 'undefined', 'الادارة', 'الإدارة', 'المشرف', 'الدعم', 'نهج_علي', 'نهجعلي'
  ]) then
    raise exception 'reserved username' using errcode = '42501';
  end if;
  return new;
end
$$;
drop trigger if exists site_username_guard on public.site_usernames;
create trigger site_username_guard before insert or update on public.site_usernames
  for each row execute function public.site_username_guard();

notify pgrst, 'reload schema';
