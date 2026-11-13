-- «استخدام المزايا» (the owner's /admin/use): which features of «الاستوديو الإبداعي» and «حيدرة كت» each person used,
-- one row per day, person and feature with how many times — no page, no words typed, nothing else about the person.
-- The feature ids are config/feature-use.ts. Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.
-- Until it runs nothing is counted and the site works as before (the page says so). Server-only (RLS on, nothing granted).

create table if not exists public.jawad_feature_use (
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (char_length(feature) <= 80 and feature ~ '^[a-z]+(\.[a-z0-9_-]+)+$'),
  uses integer not null default 0 check (uses >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, user_id, feature)
);
create index if not exists jawad_feature_use_day_idx on public.jawad_feature_use (day desc, feature);
alter table public.jawad_feature_use enable row level security;
revoke all on public.jawad_feature_use from anon, authenticated;

-- One batch from a page ({"<feature>": count, …}, already checked by the server): each count added to the person's row
-- of the day, the row made when it is not there — in one statement, so two batches at once never lose a use.
create or replace function public.jawad_feature_use_add(p_user uuid, p_day date, p_uses jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into jawad_feature_use (day, user_id, feature, uses)
  select p_day, p_user, u.key, least(greatest(u.value::integer, 0), 1000)
    from jsonb_each_text(p_uses) as u (key, value)
   where u.value ~ '^[0-9]{1,6}$'
  on conflict (day, user_id, feature)
  do update set uses = jawad_feature_use.uses + excluded.uses, updated_at = now();
$$;
revoke all on function public.jawad_feature_use_add(uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.jawad_feature_use_add(uuid, date, jsonb) to service_role;
