-- «لأجل المهدي» · «مسابقة الثبات» (the owner, 28 November 2026, for a member who runs one in his neighbourhood): anyone runs a
-- contest on keeping worship habits for one to eight weeks. Each participant picks which of their own projects count; the
-- app measures them, the organiser sees each participant's habits with their percentage (weekly too), draws the winners
-- among those who reached the bar (95% by default), and talks to them inside the app (no phone numbers).
--   · mahdi_contests          — the contest (title, rules, prize, first and last day, the bar, the join code).
--   · mahdi_contest_entries   — who joined, the projects they picked, excluded / winner / prize sent.
--   · mahdi_contest_messages  — each participant's conversation with the organiser.
-- All three are read and written only by the site's server (RLS on, no policies), like the groups.
-- Before this runs the app keeps working: «مسابقة الثبات» says it is not ready yet.
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice.

create table if not exists public.mahdi_contests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  details text not null default '' check (char_length(details) <= 1500),
  prize text not null default '' check (char_length(prize) <= 200),
  starts_on date not null,
  ends_on date not null,
  threshold smallint not null default 95 check (threshold between 50 and 100),
  min_habits smallint not null default 3 check (min_habits between 1 and 30),
  listed boolean not null default false,
  -- the dispatcher's memory: how many weekly summaries went to the organiser, and whether the end was announced
  digest_weeks smallint not null default 0,
  end_notified boolean not null default false,
  drawn_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 55)
);
create index if not exists mahdi_contests_owner_idx on public.mahdi_contests (owner_id);
create index if not exists mahdi_contests_listed_idx on public.mahdi_contests (ends_on) where listed;

create table if not exists public.mahdi_contest_entries (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.mahdi_contests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  project_ids text[] not null default '{}' check (cardinality(project_ids) <= 30),
  joined_at timestamptz not null default now(),
  excluded boolean not null default false,
  winner_rank smallint,
  prize_sent_at timestamptz,
  owner_read_at timestamptz,
  member_read_at timestamptz,
  last_message_at timestamptz,
  unique (contest_id, user_id)
);
create index if not exists mahdi_contest_entries_user_idx on public.mahdi_contest_entries (user_id);

create table if not exists public.mahdi_contest_messages (
  id bigint generated always as identity primary key,
  entry_id uuid not null references public.mahdi_contest_entries (id) on delete cascade,
  from_owner boolean not null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists mahdi_contest_messages_entry_idx on public.mahdi_contest_messages (entry_id, created_at);

alter table public.mahdi_contests enable row level security;
alter table public.mahdi_contest_entries enable row level security;
alter table public.mahdi_contest_messages enable row level security;
revoke all on public.mahdi_contests from anon, authenticated;
revoke all on public.mahdi_contest_entries from anon, authenticated;
revoke all on public.mahdi_contest_messages from anon, authenticated;

notify pgrst, 'reload schema';
