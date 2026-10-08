-- «صانع الألعاب الذكي» (قنبر): its conversations, the owner's edits of the persona, the games library the owner feeds
-- it, and the test runs. Everything is server-only (RLS on, nothing granted): the pages talk to it through the API.

-- the conversations: one row per chat, the messages kept as they were said
create table if not exists public.games_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  messages jsonb not null default '[]'::jsonb,
  usd numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists games_chats_user_idx on public.games_chats (user_id, updated_at desc);
alter table public.games_chats enable row level security;
revoke all on public.games_chats from anon, authenticated;

-- the owner's persona text (key «persona»); absent = the default in the code
create table if not exists public.games_kv (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.games_kv enable row level security;
revoke all on public.games_kv from anon, authenticated;

-- the games library: what the owner (or an approved draft) says about a game; the chat reads the approved ones
-- when a game is named, and says which facts come from here
create table if not exists public.games_library (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  name_key text not null,
  genre text not null default '' check (char_length(genre) <= 120),
  players text not null default '' check (char_length(players) <= 120),
  notes text not null default '' check (char_length(notes) <= 8000),
  status text not null default 'approved' check (status in ('approved', 'draft')),
  source text not null default 'owner' check (source in ('owner', 'draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists games_library_name_idx on public.games_library (name_key);
alter table public.games_library enable row level security;
revoke all on public.games_library from anon, authenticated;

-- the tests: a run is a batch of scenarios; each result keeps the conversation and the judge's verdict
create table if not exists public.games_test_runs (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  mode text not null default 'quick' check (mode in ('quick', 'deep')),
  total integer not null check (total between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.games_test_runs enable row level security;
revoke all on public.games_test_runs from anon, authenticated;

create table if not exists public.games_test_results (
  run_id uuid not null references public.games_test_runs (id) on delete cascade,
  idx integer not null,
  scenario jsonb not null,
  transcript jsonb not null default '[]'::jsonb,
  verdict jsonb,
  score integer,
  usd numeric not null default 0,
  error text,
  created_at timestamptz not null default now(),
  primary key (run_id, idx)
);
alter table public.games_test_results enable row level security;
revoke all on public.games_test_results from anon, authenticated;
