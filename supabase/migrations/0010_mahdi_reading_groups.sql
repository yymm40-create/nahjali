-- «لأجل المهدي» part 3: «متعلّم على سبيل نجاة» (reading), site-wide usernames, and «إخوة الولاية» (private groups).
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run (after 0007, 0008 and 0009).
--
-- Rules (same as before):
--   • Private data (library, reading sessions, goals) is read and written by its owner only (RLS).
--   • The book catalogue is shared: everyone signed in can read it, only our server writes it (after checks), and
--     the admin can hide a book that was reported.
--   • Groups are private circles. Everything about them goes through our server, which checks membership first;
--     users get no direct access to the group tables.

-- ───────────────────────── usernames (the whole site, not only this branch) ─────────────────────────
-- One unique handle per account: lowercase Latin letters, digits and _ , 3 to 20 characters, starting with a letter.
create table public.site_usernames (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z][a-z0-9_]{2,19}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger site_usernames_touch_updated_at
  before update on public.site_usernames
  for each row execute function public.touch_updated_at();

-- ───────────────────────── shared book catalogue ─────────────────────────
create table public.mahdi_books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  title_norm text not null check (char_length(title_norm) <= 200),   -- for search (Arabic letters unified)
  author text not null default '' check (char_length(author) <= 80),
  pages integer not null check (pages between 1 and 10000),
  description text not null default '' check (char_length(description) <= 500),
  cover_path text check (cover_path is null or char_length(cover_path) <= 300),
  added_by uuid references auth.users (id) on delete set null,
  hidden_at timestamptz,
  hidden_reason text not null default '' check (char_length(hidden_reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mahdi_books_title_idx on public.mahdi_books (title_norm);
create trigger mahdi_books_touch_updated_at
  before update on public.mahdi_books
  for each row execute function public.touch_updated_at();

create table public.mahdi_book_reports (
  book_id uuid not null references public.mahdi_books (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

-- ───────────────────────── my library ─────────────────────────
-- 'reading' = one of the (at most 3) books I am reading now; 'paused' = set aside, progress kept; 'finished' = on the shelf.
create table public.mahdi_user_books (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.mahdi_books (id) on delete cascade,
  state text not null default 'reading' check (state in ('reading', 'paused', 'finished')),
  added_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (user_id, book_id)
);

create function public.mahdi_user_books_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.state = 'reading' and (
    select count(*) from public.mahdi_user_books b
    where b.user_id = new.user_id and b.state = 'reading' and b.book_id <> new.book_id
  ) >= 3 then
    raise exception 'mahdi: at most 3 books at a time' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger mahdi_user_books_limit
  before insert or update on public.mahdi_user_books
  for each row execute function public.mahdi_user_books_limit();

-- ───────────────────────── reading sessions ─────────────────────────
-- One row per session (with the timer) or per manual entry (seconds = 0). `ranges` are the pages read, as
-- [[from, to], …]; progress in a book = the distinct pages over all its sessions.
create table public.mahdi_reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  book_id uuid not null,
  log_date date not null,
  started_at timestamptz,
  seconds integer not null default 0 check (seconds between 0 and 86400),
  ranges jsonb not null default '[]' check (jsonb_typeof(ranges) = 'array' and jsonb_array_length(ranges) <= 60),
  pages_count integer not null default 0 check (pages_count between 0 and 10000),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  foreign key (user_id, book_id) references public.mahdi_user_books (user_id, book_id) on delete cascade
);
create index mahdi_reading_sessions_user_idx on public.mahdi_reading_sessions (user_id, log_date);
create trigger mahdi_reading_sessions_guard
  before insert or update on public.mahdi_reading_sessions
  for each row execute function public.mahdi_logs_guard();  -- no dates in the future

-- ───────────────────────── reading goals ─────────────────────────
-- A daily and/or a weekly goal (minutes or pages). A linked habit is filled automatically after each session.
create table public.mahdi_reading_goals (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  daily_metric text check (daily_metric is null or daily_metric in ('minutes', 'pages')),
  daily_target integer check (daily_target is null or daily_target between 1 and 100000),
  weekly_metric text check (weekly_metric is null or weekly_metric in ('minutes', 'pages')),
  weekly_target integer check (weekly_target is null or weekly_target between 1 and 100000),
  habit_id uuid,
  habit_metric text not null default 'minutes' check (habit_metric in ('minutes', 'pages')),
  updated_at timestamptz not null default now(),
  check ((daily_metric is null) = (daily_target is null)),
  check ((weekly_metric is null) = (weekly_target is null)),
  -- the habit must be mine; deleting it only unlinks it
  foreign key (habit_id, user_id) references public.mahdi_habits (id, user_id) on delete set null (habit_id)
);
create trigger mahdi_reading_goals_touch_updated_at
  before update on public.mahdi_reading_goals
  for each row execute function public.touch_updated_at();

-- ───────────────────────── «إخوة الولاية»: private groups ─────────────────────────
create table public.mahdi_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  leader_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger mahdi_groups_touch_updated_at
  before update on public.mahdi_groups
  for each row execute function public.touch_updated_at();

-- 'invited' until the person accepts: nobody's numbers are shown to a group they did not agree to join
create table public.mahdi_group_members (
  group_id uuid not null references public.mahdi_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'active')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  primary key (group_id, user_id)
);
create index mahdi_group_members_user_idx on public.mahdi_group_members (user_id);

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.site_usernames enable row level security;
alter table public.mahdi_books enable row level security;
alter table public.mahdi_book_reports enable row level security;
alter table public.mahdi_user_books enable row level security;
alter table public.mahdi_reading_sessions enable row level security;
alter table public.mahdi_reading_goals enable row level security;
alter table public.mahdi_groups enable row level security;
alter table public.mahdi_group_members enable row level security;

create policy "usernames: own row" on public.site_usernames
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- A hidden book disappears from search, but stays readable for whoever added it or already has it in their library
create policy "mahdi books: signed-in users read visible ones" on public.mahdi_books
  for select to authenticated using (
    hidden_at is null
    or added_by = (select auth.uid())
    or exists (select 1 from public.mahdi_user_books ub where ub.book_id = mahdi_books.id and ub.user_id = (select auth.uid()))
  );
create policy "mahdi book reports: add own" on public.mahdi_book_reports
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "mahdi library: own rows" on public.mahdi_user_books
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mahdi reading sessions: own rows" on public.mahdi_reading_sessions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "mahdi reading goals: own row" on public.mahdi_reading_goals
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Groups: no policy on purpose (only the server, with its own checks). Members may see their own membership rows.
create policy "mahdi group members: read own rows" on public.mahdi_group_members
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.site_usernames, public.mahdi_books, public.mahdi_book_reports, public.mahdi_user_books,
  public.mahdi_reading_sessions, public.mahdi_reading_goals, public.mahdi_groups, public.mahdi_group_members from anon;
grant select, insert, update, delete on public.site_usernames, public.mahdi_user_books, public.mahdi_reading_sessions,
  public.mahdi_reading_goals to authenticated;
grant select on public.mahdi_books, public.mahdi_group_members to authenticated;
grant insert on public.mahdi_book_reports to authenticated;

-- ───────────────────────── Storage: book covers ─────────────────────────
-- Resized on our server to WebP (which also drops location data) and saved under a random name.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('mahdi-book-covers', 'mahdi-book-covers', true, 1048576, array['image/webp']);

-- ───────────────────────── community: two new kinds of shared cards ─────────────────────────
-- «قراءتي هذا الأسبوع» and «أنهيت كتابًا»
alter table public.mahdi_posts drop constraint if exists mahdi_posts_kind_check;
alter table public.mahdi_posts add constraint mahdi_posts_kind_check
  check (kind in ('week', 'month', 'day', 'streak', 'milestone', 'compare', 'project', 'habit', 'reading', 'book'));
