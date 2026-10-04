-- «لأجل المهدي» · the community becomes social: follows (with private accounts), personal pages, posts with a photo,
-- a quote or a video of up to 30 seconds, «أحسنت», comments, view counts, stories (24 hours) and easy reports.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run (after 0019).
--
-- Rules:
--   • Who can see a person's posts and stories: everyone signed in, or — for a private account — only the followers
--     they accepted (public.mahdi_can_see). Enforced by RLS on every read.
--   • Media live in a private bucket; the server hands out short links only for what the viewer may see.
--   • Follows, views and media are written by the server after its checks; comments through RLS.
--   • Reports reach the owner at once; three reports hide the post or story until the owner reviews it.

-- ───────────────────────── privacy and public identity ─────────────────────────
alter table public.mahdi_privacy
  add column if not exists private_account boolean not null default false,  -- only accepted followers see posts/stories
  add column if not exists stories_in_feed boolean not null default true;   -- stories on top of the feed, or in their own place

alter table public.mahdi_public_profiles
  add column if not exists username text check (username is null or char_length(username) <= 30);  -- copied from site_usernames
create unique index if not exists mahdi_public_profiles_username_idx on public.mahdi_public_profiles (lower(username)) where username is not null;
update public.mahdi_public_profiles p set username = u.username from public.site_usernames u where u.user_id = p.user_id and p.username is null;

-- ───────────────────────── follows ─────────────────────────
create table if not exists public.mahdi_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'accepted' check (status in ('accepted', 'pending')),
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists mahdi_follows_followee_idx on public.mahdi_follows (followee_id, status);

alter table public.mahdi_follows enable row level security;
drop policy if exists "mahdi follows: my own rows" on public.mahdi_follows;
create policy "mahdi follows: my own rows" on public.mahdi_follows
  for select to authenticated using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));
revoke all on public.mahdi_follows from anon, authenticated;
grant select on public.mahdi_follows to authenticated;

-- May the signed-in user see this person's posts and stories?
create or replace function public.mahdi_can_see(p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_author = (select auth.uid())
    or not coalesce((select pr.private_account from public.mahdi_privacy pr where pr.user_id = p_author), false)
    or exists (
      select 1 from public.mahdi_follows f
      where f.follower_id = (select auth.uid()) and f.followee_id = p_author and f.status = 'accepted'
    );
$$;
revoke all on function public.mahdi_can_see(uuid) from public, anon;
grant execute on function public.mahdi_can_see(uuid) to authenticated, service_role;

-- ───────────────────────── posts: photo, quote, video ─────────────────────────
alter table public.mahdi_posts drop constraint if exists mahdi_posts_kind_check;
alter table public.mahdi_posts add constraint mahdi_posts_kind_check
  check (kind in ('week', 'month', 'day', 'streak', 'milestone', 'compare', 'project', 'habit', 'reading', 'book', 'photo', 'quote', 'video'));
alter table public.mahdi_posts
  add column if not exists caption text not null default '' check (char_length(caption) <= 1000),
  add column if not exists media_path text check (media_path is null or char_length(media_path) <= 300),
  add column if not exists media_kind text check (media_kind is null or media_kind in ('image', 'video')),
  add column if not exists media_ms integer check (media_ms is null or media_ms between 1 and 31000),
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists views integer not null default 0,
  add column if not exists comments integer not null default 0;

drop policy if exists "mahdi posts: signed-in users read visible ones" on public.mahdi_posts;
drop policy if exists "mahdi posts: visible to whoever may see the author" on public.mahdi_posts;
create policy "mahdi posts: visible to whoever may see the author" on public.mahdi_posts
  for select to authenticated using ((hidden_at is null and public.mahdi_can_see(user_id)) or user_id = (select auth.uid()));

-- «أحسنت» instead of a like (the older دعاء / تشجيع stay valid)
alter table public.mahdi_post_reactions drop constraint if exists mahdi_post_reactions_kind_check;
alter table public.mahdi_post_reactions add constraint mahdi_post_reactions_kind_check check (kind in ('dua', 'support', 'ahsant'));

-- Reports: what kind of problem (singing/music, indecent scenes, abuse, other)
alter table public.mahdi_post_reports
  add column if not exists category text not null default 'other' check (category in ('singing', 'indecent', 'abuse', 'other'));

-- ───────────────────────── comments ─────────────────────────
create table if not exists public.mahdi_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.mahdi_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists mahdi_post_comments_post_idx on public.mahdi_post_comments (post_id, created_at);

alter table public.mahdi_post_comments enable row level security;
-- The post's own visibility rule decides (the subquery runs under the reader's RLS)
drop policy if exists "mahdi comments: read on posts I can see" on public.mahdi_post_comments;
create policy "mahdi comments: read on posts I can see" on public.mahdi_post_comments
  for select to authenticated using (exists (select 1 from public.mahdi_posts p where p.id = post_id));
drop policy if exists "mahdi comments: write on posts I can see" on public.mahdi_post_comments;
create policy "mahdi comments: write on posts I can see" on public.mahdi_post_comments
  for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.mahdi_posts p where p.id = post_id and p.hidden_at is null));
drop policy if exists "mahdi comments: delete mine or on my post" on public.mahdi_post_comments;
create policy "mahdi comments: delete mine or on my post" on public.mahdi_post_comments
  for delete to authenticated using (user_id = (select auth.uid()) or exists (select 1 from public.mahdi_posts p where p.id = post_id and p.user_id = (select auth.uid())));
revoke all on public.mahdi_post_comments from anon, authenticated;
grant select, insert, delete on public.mahdi_post_comments to authenticated;

create or replace function public.mahdi_post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.mahdi_posts set comments = comments + 1 where id = new.post_id;
  else
    update public.mahdi_posts set comments = greatest(0, comments - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;
drop trigger if exists mahdi_post_comments_count on public.mahdi_post_comments;
create trigger mahdi_post_comments_count after insert or delete on public.mahdi_post_comments
  for each row execute function public.mahdi_post_comments_count();

-- ───────────────────────── views (one per person) ─────────────────────────
create table if not exists public.mahdi_post_views (
  post_id uuid not null references public.mahdi_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.mahdi_post_views enable row level security;
revoke all on public.mahdi_post_views from anon, authenticated;

create or replace function public.mahdi_post_views_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.mahdi_posts set views = views + 1 where id = new.post_id;
  return null;
end;
$$;
drop trigger if exists mahdi_post_views_count on public.mahdi_post_views;
create trigger mahdi_post_views_count after insert on public.mahdi_post_views
  for each row execute function public.mahdi_post_views_count();

-- ───────────────────────── stories (24 hours) ─────────────────────────
create table if not exists public.mahdi_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.mahdi_public_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('photo', 'video', 'quote')),
  media_path text check (media_path is null or char_length(media_path) <= 300),
  media_ms integer check (media_ms is null or media_ms between 1 and 31000),
  width integer,
  height integer,
  text text not null default '' check (char_length(text) <= 500),
  style text not null default '' check (char_length(style) <= 20),
  views integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  hidden_at timestamptz,
  hidden_reason text not null default '' check (char_length(hidden_reason) <= 200)
);
create index if not exists mahdi_stories_live_idx on public.mahdi_stories (expires_at desc) where hidden_at is null;
create index if not exists mahdi_stories_user_idx on public.mahdi_stories (user_id, created_at desc);

alter table public.mahdi_stories enable row level security;
drop policy if exists "mahdi stories: live ones of people I can see" on public.mahdi_stories;
create policy "mahdi stories: live ones of people I can see" on public.mahdi_stories
  for select to authenticated using ((hidden_at is null and expires_at > now() and public.mahdi_can_see(user_id)) or user_id = (select auth.uid()));
revoke all on public.mahdi_stories from anon, authenticated;
grant select on public.mahdi_stories to authenticated;

create table if not exists public.mahdi_story_views (
  story_id uuid not null references public.mahdi_stories (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
alter table public.mahdi_story_views enable row level security;
revoke all on public.mahdi_story_views from anon, authenticated;

create or replace function public.mahdi_story_views_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.mahdi_stories set views = views + 1 where id = new.story_id;
  return null;
end;
$$;
drop trigger if exists mahdi_story_views_count on public.mahdi_story_views;
create trigger mahdi_story_views_count after insert on public.mahdi_story_views
  for each row execute function public.mahdi_story_views_count();

create table if not exists public.mahdi_story_reports (
  story_id uuid not null references public.mahdi_stories (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null default 'other' check (category in ('singing', 'indecent', 'abuse', 'other')),
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
alter table public.mahdi_story_reports enable row level security;
revoke all on public.mahdi_story_reports from anon, authenticated;

-- ───────────────────────── media (private) ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('mahdi-media', 'mahdi-media', false, 52428800, array['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;
