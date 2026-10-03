-- «لأجل المهدي» (the site's third branch). Independent from the booklet and film tables.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.
--
-- Access model (stricter than the booklet's, on purpose):
--   • Every table has Row Level Security. A signed-in user can read and write ONLY their own rows,
--     and the database itself enforces it: changing an id in a URL or a request returns nothing.
--   • Our API routes act as the signed-in user (not the service role), so the same rules apply to them.
--   • Composite foreign keys make it impossible to attach a habit to someone else's project.
--   • Catalog tables (shrines, motivational phrases, verified religious texts) are read-only for users.

-- ───────────────────────── shrines (catalog; the admin manages it later) ─────────────────────────
create table public.mahdi_shrines (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 120),
  place text not null default '' check (char_length(place) <= 80),
  image_url text check (image_url is null or char_length(image_url) <= 500),  -- null = placeholder («قريبًا»)
  image_alt text not null default '' check (char_length(image_alt) <= 200),
  image_position text not null default '50% 50%' check (image_position ~ '^[0-9]{1,3}% [0-9]{1,3}%$'),
  image_credit text not null default '' check (char_length(image_credit) <= 300),
  is_artwork boolean not null default false,  -- true when the picture is an illustration, not a photograph
  sort_order integer not null default 0,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger mahdi_shrines_touch_updated_at
  before update on public.mahdi_shrines
  for each row execute function public.touch_updated_at();

insert into public.mahdi_shrines (id, name, place, image_url, image_alt, image_position, is_artwork, sort_order, active) values
  ('imam-ali', 'حرم الإمام علي عليه السلام', 'النجف الأشرف', '/mahdi/shrines/imam-ali.jpg',
   'حرم أمير المؤمنين علي عليه السلام في النجف الأشرف', '44% 62%', true, 1, true),
  ('prophet', 'المسجد النبوي الشريف', 'المدينة المنورة', null, '', '50% 50%', false, 2, false),
  ('baqi', 'البقيع، أئمة البقيع عليهم السلام', 'المدينة المنورة', null, '', '50% 50%', false, 3, false),
  ('imam-hussain', 'حرم الإمام الحسين عليه السلام', 'كربلاء المقدسة', null, '', '50% 50%', false, 4, false),
  ('kadhimiya', 'الحرم الكاظمي الشريف', 'الكاظمية المقدسة', null, '', '50% 50%', false, 5, false),
  ('imam-ridha', 'حرم الإمام الرضا عليه السلام', 'مشهد المقدسة', null, '', '50% 50%', false, 6, false),
  ('askariyain', 'حرم الإمامين العسكريين عليهما السلام', 'سامراء المقدسة', null, '', '50% 50%', false, 7, false);

-- ───────────────────────── profiles (one per user, separate from the booklet's `profiles`) ─────────────────────────
create table public.mahdi_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 30),  -- «الموالي: …»
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 300),
  shrine_id text not null default 'imam-ali' references public.mahdi_shrines (id),
  theme text not null default 'cinematic' check (theme in ('cinematic', 'minimal', 'night')),
  theme_variant text not null default '' check (char_length(theme_variant) <= 40),
  time_zone text not null default 'Asia/Riyadh' check (char_length(time_zone) between 1 and 64),
  week_start smallint not null default 6 check (week_start between 0 and 6),  -- 0 = Sunday … 6 = Saturday
  show_hijri boolean not null default true,
  hijri_offset smallint not null default 0 check (hijri_offset between -2 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger mahdi_profiles_touch_updated_at
  before update on public.mahdi_profiles
  for each row execute function public.touch_updated_at();

-- ───────────────────────── projects ─────────────────────────
create table public.mahdi_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  icon text not null default '' check (char_length(icon) <= 16),
  color text not null default 'gold'
    check (color in ('gold', 'emerald', 'lapis', 'turquoise', 'garnet', 'amber', 'olive', 'stone')),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index mahdi_projects_user_idx on public.mahdi_projects (user_id, sort_order);
create trigger mahdi_projects_touch_updated_at
  before update on public.mahdi_projects
  for each row execute function public.touch_updated_at();

-- ───────────────────────── habits ─────────────────────────
-- Stable details only. Target, unit, schedule and paused/archived state live in mahdi_habit_versions.
create table public.mahdi_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  icon text not null default '' check (char_length(icon) <= 16),
  category text not null default '' check (char_length(category) <= 30),
  notes text not null default '' check (char_length(notes) <= 500),
  reminder_time time,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- the project must belong to the same user
  foreign key (project_id, user_id) references public.mahdi_projects (id, user_id) on delete cascade
);
create index mahdi_habits_user_idx on public.mahdi_habits (user_id, project_id, sort_order);
create trigger mahdi_habits_touch_updated_at
  before update on public.mahdi_habits
  for each row execute function public.touch_updated_at();

-- ───────────────────────── habit versions (history of goals) ─────────────────────────
-- A change of target, unit or schedule, a pause or an archive adds a version from that day on.
-- Earlier days keep being measured against the version that was in effect then.
create table public.mahdi_habit_versions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null,
  user_id uuid not null default auth.uid(),
  effective_from date not null,
  measure text not null check (measure in ('check', 'count', 'amount')),
  target numeric(12, 2) not null check (target > 0 and target <= 1000000),
  unit text not null default '' check (char_length(unit) <= 20),
  freq text not null check (freq in ('daily', 'days', 'weekly', 'monthly')),
  days smallint[] not null default '{}',  -- for freq 'days': weekdays, 0 = Sunday … 6 = Saturday
  state text not null default 'active' check (state in ('active', 'paused', 'archived')),
  reason text not null default '' check (reason in ('', 'project_archived')),
  prev_state text check (prev_state is null or prev_state in ('active', 'paused')),  -- restored when the project comes back
  created_at timestamptz not null default now(),
  unique (habit_id, effective_from),
  foreign key (habit_id, user_id) references public.mahdi_habits (id, user_id) on delete cascade,
  check (days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  check (freq <> 'days' or cardinality(days) between 1 and 7),
  -- done/not-done: one goal per day, or a number of days per week/month
  check (measure <> 'check'
         or (freq in ('daily', 'days') and target = 1)
         or (freq = 'weekly' and target between 1 and 7)
         or (freq = 'monthly' and target between 1 and 31)),
  check (measure = 'amount' or target = trunc(target))
);
create index mahdi_habit_versions_user_idx on public.mahdi_habit_versions (user_id);

-- ───────────────────────── logs (one row per habit per day) ─────────────────────────
-- `value` is the day's total (done = 1, a counter's count, or an amount). Rows with 0 are kept on purpose:
-- `client_updated_at` decides which of two late-arriving edits wins (needed for offline sync).
create table public.mahdi_logs (
  habit_id uuid not null,
  user_id uuid not null default auth.uid(),
  log_date date not null,
  value numeric(12, 2) not null check (value >= 0 and value <= 1000000),
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (habit_id, log_date),
  foreign key (habit_id, user_id) references public.mahdi_habits (id, user_id) on delete cascade
);
create index mahdi_logs_user_date_idx on public.mahdi_logs (user_id, log_date);

-- No logging for a day that has not started anywhere yet (UTC+14 is at most one day ahead of UTC)
create function public.mahdi_logs_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.log_date > (now() at time zone 'utc')::date + 1 then
    raise exception 'mahdi: log date is in the future' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger mahdi_logs_guard
  before insert or update on public.mahdi_logs
  for each row execute function public.mahdi_logs_guard();

-- ───────────────────────── motivational content ─────────────────────────
-- Original phrases written for the app. They are NOT attributed to anyone.
create table public.mahdi_phrases (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 2 and 200),
  contexts text[] not null default '{home}'
    check (contexts <@ array['home', 'day_complete', 'weekly', 'monthly', 'comeback', 'milestone', 'notification']::text[]),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Quran, hadith, du'a, ziyara and scholars' words. Shown ONLY when verified, and always with the source.
-- Left empty on purpose: the admin adds each text with its source and reference.
create table public.mahdi_religious_texts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('quran', 'hadith', 'dua', 'ziyara', 'scholar')),
  text text not null check (char_length(text) between 2 and 2000),
  attribution text not null default '' check (char_length(attribution) <= 200),  -- who it is attributed to (or the surah)
  source text not null check (char_length(source) between 2 and 300),            -- the book
  reference text not null default '' check (char_length(reference) <= 300),       -- volume, page, number or verse
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  verified_by text not null default '' check (char_length(verified_by) <= 120),
  verified_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 1000),
  contexts text[] not null default '{home}'
    check (contexts <@ array['home', 'day_complete', 'weekly', 'monthly', 'comeback', 'milestone', 'notification']::text[]),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verification_status <> 'verified' or verified_at is not null)
);
create trigger mahdi_religious_texts_touch_updated_at
  before update on public.mahdi_religious_texts
  for each row execute function public.touch_updated_at();

insert into public.mahdi_phrases (text, contexts, sort_order) values
  ('خطوة صغيرة اليوم، وثباتٌ أكبر غدًا.', '{home}', 1),
  ('ما تداوم عليه هو ما يصنعك.', '{home}', 2),
  ('ابدأ بما تستطيع، وأكمل بما تحب.', '{home}', 3),
  ('اليوم فرصة جديدة لإصلاح النفس.', '{home}', 4),
  ('العمل الهادف يبدأ بنيّة واضحة.', '{home}', 5),
  ('الانتظار الحقيقي عملٌ واستعداد.', '{home}', 6),
  ('كن اليوم أقرب لما تريد أن تكونه.', '{home}', 7),
  ('حسن العمل أن تتقنه ولو كان صغيرًا.', '{home}', 8),
  ('الثبات يُبنى يومًا بعد يوم.', '{home}', 9),
  ('اجعل لكل يوم نصيبًا من بناء نفسك.', '{home}', 10),
  ('راجع يومك بهدوء، وابدأ غدك بعزم.', '{home}', 11),
  ('أتممت عادات اليوم. بارك الله في سعيك.', '{day_complete}', 20),
  ('يومٌ مكتمل. هكذا يُبنى الثبات.', '{day_complete}', 21),
  ('أحسنت. يومك اليوم شاهدٌ على عزمك.', '{day_complete}', 22),
  ('اكتمل يومك، فاحفظ هذا الأثر الجميل.', '{day_complete}', 23),
  ('أسبوعٌ آخر في طريق إصلاح النفس.', '{weekly}', 30),
  ('انظر إلى أسبوعك بعين المحاسبة لا بعين اللوم.', '{weekly}', 31),
  ('كل أسبوع تثبت فيه يقرّبك أكثر.', '{weekly}', 32),
  ('قيّم أسبوعك، واختر خطوة واحدة تحسّنها.', '{weekly}', 33),
  ('شهرٌ من العمل الهادف. استمر.', '{monthly}', 40),
  ('محاسبة الشهر بداية جديدة، لا حكمٌ نهائي.', '{monthly}', 41),
  ('ما تراكم في شهرك هو ثمرة عاداتك.', '{monthly}', 42),
  ('أهلًا بعودتك. البداية من جديد شجاعة.', '{comeback}', 50),
  ('لا بأس بما فات، المهم ما تبدأه الآن.', '{comeback}', 51),
  ('عُد بخطوة واحدة اليوم، والطريق يعود معك.', '{comeback}', 52),
  ('بلغت معلمًا جديدًا في طريق الثبات.', '{milestone}', 60),
  ('ثباتك يثمر. هذه علامة على الطريق.', '{milestone}', 61),
  ('ما زال أمامك بعض عادات اليوم. عُد إليها حين تستطيع.', '{notification}', 70),
  ('لحظة هادئة لعاداتك؟ يومك ما زال مفتوحًا.', '{notification}', 71),
  ('خطوة صغيرة الآن تكمل يومك.', '{notification}', 72);

-- ───────────────────────── functions (run as the signed-in user, so RLS still applies) ─────────────────────────

-- Sets a day's value. A late edit never overwrites a newer one (offline sync). Returns the stored value.
create function public.mahdi_set_log(p_habit uuid, p_date date, p_value numeric, p_client_ts timestamptz)
returns numeric
language sql
security invoker
set search_path = ''
as $$
  with up as (
    insert into public.mahdi_logs as l (habit_id, user_id, log_date, value, client_updated_at)
    values (p_habit, (select auth.uid()), p_date, p_value, p_client_ts)
    on conflict (habit_id, log_date) do update
      set value = excluded.value, client_updated_at = excluded.client_updated_at, updated_at = now()
      where l.client_updated_at <= excluded.client_updated_at
    returning l.value
  )
  select coalesce(
    (select value from up),
    (select value from public.mahdi_logs where habit_id = p_habit and log_date = p_date)
  );
$$;

-- Creates a habit and its first version together.
create function public.mahdi_create_habit(
  p_project uuid, p_name text, p_icon text, p_category text, p_notes text, p_reminder time,
  p_start date, p_measure text, p_target numeric, p_unit text, p_freq text, p_days smallint[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.mahdi_habits (user_id, project_id, name, icon, category, notes, reminder_time, sort_order)
  values (
    (select auth.uid()), p_project, p_name, p_icon, p_category, p_notes, p_reminder,
    coalesce((select max(h.sort_order) + 1 from public.mahdi_habits h where h.project_id = p_project), 0)
  )
  returning id into v_id;

  insert into public.mahdi_habit_versions (habit_id, user_id, effective_from, measure, target, unit, freq, days)
  values (v_id, (select auth.uid()), p_start, p_measure, p_target, p_unit, p_freq, p_days);

  return v_id;
end;
$$;

-- Archives (or brings back) a project with its habits. Habits that were archived on their own stay archived;
-- the others return to the state they had (active or paused).
create function public.mahdi_archive_project(p_project uuid, p_date date, p_archive boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_archive then
    insert into public.mahdi_habit_versions as t
      (habit_id, user_id, effective_from, measure, target, unit, freq, days, state, reason, prev_state)
    select v.habit_id, v.user_id, greatest(p_date, f.first_day), v.measure, v.target, v.unit, v.freq, v.days,
           'archived', 'project_archived', v.state
    from public.mahdi_habits h
    cross join lateral (
      select min(x.effective_from) as first_day from public.mahdi_habit_versions x where x.habit_id = h.id
    ) f
    cross join lateral (
      select * from public.mahdi_habit_versions x where x.habit_id = h.id order by x.effective_from desc limit 1
    ) v
    where h.project_id = p_project and v.state <> 'archived'
    on conflict (habit_id, effective_from) do update
      set state = 'archived', reason = 'project_archived', prev_state = t.state;

    update public.mahdi_projects set archived_at = now() where id = p_project and archived_at is null;
  else
    insert into public.mahdi_habit_versions as t
      (habit_id, user_id, effective_from, measure, target, unit, freq, days, state, reason, prev_state)
    select v.habit_id, v.user_id, greatest(p_date, f.first_day), v.measure, v.target, v.unit, v.freq, v.days,
           coalesce(v.prev_state, 'active'), '', null
    from public.mahdi_habits h
    cross join lateral (
      select min(x.effective_from) as first_day from public.mahdi_habit_versions x where x.habit_id = h.id
    ) f
    cross join lateral (
      select * from public.mahdi_habit_versions x where x.habit_id = h.id order by x.effective_from desc limit 1
    ) v
    where h.project_id = p_project and v.state = 'archived' and v.reason = 'project_archived'
    on conflict (habit_id, effective_from) do update
      set state = excluded.state, reason = '', prev_state = null;

    update public.mahdi_projects set archived_at = null where id = p_project;
  end if;
end;
$$;

-- Saves a new order (the position in the array becomes the sort order)
create function public.mahdi_reorder_projects(p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.mahdi_projects p set sort_order = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
  where p.id = o.id;
$$;

create function public.mahdi_reorder_habits(p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.mahdi_habits h set sort_order = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
  where h.id = o.id;
$$;

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.mahdi_shrines enable row level security;
alter table public.mahdi_profiles enable row level security;
alter table public.mahdi_projects enable row level security;
alter table public.mahdi_habits enable row level security;
alter table public.mahdi_habit_versions enable row level security;
alter table public.mahdi_logs enable row level security;
alter table public.mahdi_phrases enable row level security;
alter table public.mahdi_religious_texts enable row level security;

create policy "mahdi shrines: everyone reads" on public.mahdi_shrines
  for select to anon, authenticated using (true);

create policy "mahdi profiles: own rows" on public.mahdi_profiles
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mahdi projects: own rows" on public.mahdi_projects
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mahdi habits: own rows" on public.mahdi_habits
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mahdi habit versions: own rows" on public.mahdi_habit_versions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mahdi logs: own rows" on public.mahdi_logs
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "mahdi phrases: signed-in users read active ones" on public.mahdi_phrases
  for select to authenticated using (active);
create policy "mahdi religious texts: signed-in users read verified ones" on public.mahdi_religious_texts
  for select to authenticated using (active and verification_status = 'verified');

-- Visitors who are not signed in get nothing from the private tables, not even an empty answer
revoke all on public.mahdi_profiles, public.mahdi_projects, public.mahdi_habits,
  public.mahdi_habit_versions, public.mahdi_logs, public.mahdi_phrases, public.mahdi_religious_texts from anon;
grant select on public.mahdi_shrines to anon, authenticated;
grant select, insert, update, delete on public.mahdi_profiles, public.mahdi_projects, public.mahdi_habits,
  public.mahdi_habit_versions, public.mahdi_logs to authenticated;
grant select on public.mahdi_phrases, public.mahdi_religious_texts to authenticated;

revoke execute on function public.mahdi_set_log(uuid, date, numeric, timestamptz) from public, anon;
revoke execute on function public.mahdi_create_habit(uuid, text, text, text, text, time, date, text, numeric, text, text, smallint[]) from public, anon;
revoke execute on function public.mahdi_archive_project(uuid, date, boolean) from public, anon;
revoke execute on function public.mahdi_reorder_projects(uuid[]) from public, anon;
revoke execute on function public.mahdi_reorder_habits(uuid[]) from public, anon;
grant execute on function public.mahdi_set_log(uuid, date, numeric, timestamptz) to authenticated;
grant execute on function public.mahdi_create_habit(uuid, text, text, text, text, time, date, text, numeric, text, text, smallint[]) to authenticated;
grant execute on function public.mahdi_archive_project(uuid, date, boolean) to authenticated;
grant execute on function public.mahdi_reorder_projects(uuid[]) to authenticated;
grant execute on function public.mahdi_reorder_habits(uuid[]) to authenticated;

-- ───────────────────────── Storage ─────────────────────────
-- Profile pictures: resized on our server and saved under a random name. Shown in the community only
-- if the user chooses to share their picture.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('mahdi-avatars', 'mahdi-avatars', true, 1048576, array['image/webp']);
