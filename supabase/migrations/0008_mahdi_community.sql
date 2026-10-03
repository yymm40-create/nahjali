-- «لأجل المهدي» part 2: rewards, privacy, community, unified challenges, notifications.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run (after 0007_mahdi.sql).
--
-- Rules:
--   • Private data stays private: each user reads and writes only their own rows (RLS).
--   • What others can see lives in SEPARATE public tables that only our server writes, and only after the
--     user switched sharing on: mahdi_public_profiles and mahdi_posts. Numbers in posts are computed by the
--     server from the user's real data, never taken from the browser.
--   • Unified challenges and their sections are defined by the admin; users only join them.

-- ───────────────────────── look & rewards ─────────────────────────
alter table public.mahdi_profiles
  add column frame text not null default '' check (char_length(frame) <= 40),
  add column view_mode text not null default 'list' check (view_mode in ('list', 'compact'));

-- Unlocked rewards. Written by the server after it re-computes the milestone from the user's data.
create table public.mahdi_user_rewards (
  user_id uuid not null references auth.users (id) on delete cascade,
  milestone_id text not null check (milestone_id ~ '^[a-z0-9_]{2,40}$'),
  unlocked_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (user_id, milestone_id)
);

-- ───────────────────────── privacy (everything off by default) ─────────────────────────
create table public.mahdi_privacy (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  community boolean not null default false,      -- appear in the community at all
  leaderboard boolean not null default false,    -- appear in the general ranking
  show_avatar boolean not null default false,    -- show the picture to others
  updated_at timestamptz not null default now()
);
create trigger mahdi_privacy_touch_updated_at
  before update on public.mahdi_privacy
  for each row execute function public.touch_updated_at();

-- The public face of a user who joined the community (name, optional picture, frame). Server-written.
create table public.mahdi_public_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  frame text not null default '' check (char_length(frame) <= 40),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── community posts ─────────────────────────
create table public.mahdi_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.mahdi_public_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('week', 'month', 'day', 'streak', 'milestone', 'compare', 'project', 'habit')),
  payload jsonb not null default '{}' check (pg_column_size(payload) <= 4096),
  closing text not null default '' check (char_length(closing) <= 60),  -- one of the preset closing lines
  created_at timestamptz not null default now(),
  hidden_at timestamptz,
  hidden_reason text not null default '' check (char_length(hidden_reason) <= 200)
);
create index mahdi_posts_feed_idx on public.mahdi_posts (created_at desc) where hidden_at is null;
create index mahdi_posts_user_idx on public.mahdi_posts (user_id, created_at desc);

create table public.mahdi_post_reactions (
  post_id uuid not null references public.mahdi_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('dua', 'support')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

create table public.mahdi_post_reports (
  post_id uuid not null references public.mahdi_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ───────────────────────── unified challenges (defined by the admin) ─────────────────────────
create table public.mahdi_challenge_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 500),
  icon text not null default '' check (char_length(icon) <= 16),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.mahdi_challenges (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.mahdi_challenge_sections (id) on delete restrict,
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  rules text not null default '' check (char_length(rules) <= 2000),
  measure text not null check (measure in ('check', 'count', 'amount')),
  target numeric(12, 2) not null check (target > 0 and target <= 1000000),
  unit text not null default '' check (char_length(unit) <= 20),
  freq text not null check (freq in ('daily', 'weekly', 'monthly')),
  starts_on date not null,
  ends_on date,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  leaderboard boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  check (measure <> 'check' or (freq = 'daily' and target = 1) or (freq = 'weekly' and target between 1 and 7) or (freq = 'monthly' and target between 1 and 31)),
  check (measure = 'amount' or target = trunc(target))
);
create trigger mahdi_challenges_touch_updated_at
  before update on public.mahdi_challenges
  for each row execute function public.touch_updated_at();

create table public.mahdi_challenge_members (
  challenge_id uuid not null references public.mahdi_challenges (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  joined_on date not null,
  left_on date,
  on_leaderboard boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create table public.mahdi_challenge_logs (
  challenge_id uuid not null,
  user_id uuid not null default auth.uid(),
  log_date date not null,
  value numeric(12, 2) not null check (value >= 0 and value <= 1000000),
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id, log_date),
  foreign key (challenge_id, user_id) references public.mahdi_challenge_members (challenge_id, user_id) on delete cascade
);
create trigger mahdi_challenge_logs_guard
  before insert or update on public.mahdi_challenge_logs
  for each row execute function public.mahdi_logs_guard();

create function public.mahdi_set_challenge_log(p_challenge uuid, p_date date, p_value numeric, p_client_ts timestamptz)
returns numeric
language sql
security invoker
set search_path = ''
as $$
  with up as (
    insert into public.mahdi_challenge_logs as l (challenge_id, user_id, log_date, value, client_updated_at)
    values (p_challenge, (select auth.uid()), p_date, p_value, p_client_ts)
    on conflict (challenge_id, user_id, log_date) do update
      set value = excluded.value, client_updated_at = excluded.client_updated_at, updated_at = now()
      where l.client_updated_at <= excluded.client_updated_at
    returning l.value
  )
  select coalesce(
    (select value from up),
    (select value from public.mahdi_challenge_logs where challenge_id = p_challenge and user_id = (select auth.uid()) and log_date = p_date)
  );
$$;

-- ───────────────────────── notifications ─────────────────────────
create table public.mahdi_notification_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  mode text not null default 'off' check (mode in ('off', 'daily', 'every_12h', 'every_6h', 'custom')),
  times text[] not null default '{20:00}' check (cardinality(times) <= 6),
  quiet_start text not null default '23:00' check (quiet_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  quiet_end text not null default '07:00' check (quiet_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  habit_reminders boolean not null default true,
  last_sent_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger mahdi_notification_settings_touch_updated_at
  before update on public.mahdi_notification_settings
  for each row execute function public.touch_updated_at();

create table public.mahdi_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now(),
  failures integer not null default 0
);
create index mahdi_push_user_idx on public.mahdi_push_subscriptions (user_id);

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.mahdi_user_rewards enable row level security;
alter table public.mahdi_privacy enable row level security;
alter table public.mahdi_public_profiles enable row level security;
alter table public.mahdi_posts enable row level security;
alter table public.mahdi_post_reactions enable row level security;
alter table public.mahdi_post_reports enable row level security;
alter table public.mahdi_challenge_sections enable row level security;
alter table public.mahdi_challenges enable row level security;
alter table public.mahdi_challenge_members enable row level security;
alter table public.mahdi_challenge_logs enable row level security;
alter table public.mahdi_notification_settings enable row level security;
alter table public.mahdi_push_subscriptions enable row level security;

-- Own rows only
create policy "mahdi rewards: read own" on public.mahdi_user_rewards
  for select to authenticated using (user_id = (select auth.uid()));
create policy "mahdi rewards: mark own as seen" on public.mahdi_user_rewards
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mahdi privacy: own row" on public.mahdi_privacy
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mahdi challenge members: own rows" on public.mahdi_challenge_members
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mahdi challenge logs: own rows" on public.mahdi_challenge_logs
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mahdi notifications: own row" on public.mahdi_notification_settings
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mahdi push: own rows" on public.mahdi_push_subscriptions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mahdi reactions: read all, write own" on public.mahdi_post_reactions
  for select to authenticated using (true);
create policy "mahdi reactions: add own" on public.mahdi_post_reactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "mahdi reactions: remove own" on public.mahdi_post_reactions
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "mahdi reports: add own" on public.mahdi_post_reports
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Public to signed-in users (written only by our server)
create policy "mahdi public profiles: signed-in users read" on public.mahdi_public_profiles
  for select to authenticated using (true);
create policy "mahdi posts: signed-in users read visible ones" on public.mahdi_posts
  for select to authenticated using (hidden_at is null or user_id = (select auth.uid()));
create policy "mahdi challenge sections: signed-in users read active" on public.mahdi_challenge_sections
  for select to authenticated using (active);
create policy "mahdi challenges: signed-in users read published" on public.mahdi_challenges
  for select to authenticated using (status = 'published');

revoke all on public.mahdi_user_rewards, public.mahdi_privacy, public.mahdi_public_profiles, public.mahdi_posts,
  public.mahdi_post_reactions, public.mahdi_post_reports, public.mahdi_challenge_sections, public.mahdi_challenges,
  public.mahdi_challenge_members, public.mahdi_challenge_logs, public.mahdi_notification_settings,
  public.mahdi_push_subscriptions from anon;
grant select, update on public.mahdi_user_rewards to authenticated;
grant select, insert, update, delete on public.mahdi_privacy, public.mahdi_challenge_members, public.mahdi_challenge_logs,
  public.mahdi_notification_settings, public.mahdi_push_subscriptions to authenticated;
grant select on public.mahdi_public_profiles, public.mahdi_posts, public.mahdi_challenge_sections, public.mahdi_challenges to authenticated;
grant select, insert, delete on public.mahdi_post_reactions to authenticated;
grant insert on public.mahdi_post_reports to authenticated;
revoke execute on function public.mahdi_set_challenge_log(uuid, date, numeric, timestamptz) from public, anon;
grant execute on function public.mahdi_set_challenge_log(uuid, date, numeric, timestamptz) to authenticated;

-- A starting section for unified challenges. The admin adds the challenges themselves (activity, measure,
-- goal, dates, rules); nothing about religious rulings or amounts is decided here.
insert into public.mahdi_challenge_sections (name, description, icon, sort_order) values
  ('العبادات', 'تحديات موحدة يتابع فيها الجميع النشاط نفسه بالتعريف نفسه، فتكون المقارنة عادلة.', '🕌', 1);
