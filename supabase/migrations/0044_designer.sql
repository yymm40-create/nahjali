-- «المصمم الذكي» (كاظم): its conversations (with the project's record and the design waiting to be made), the owner's
-- edits of the persona and the section's switch, the pictures it produced (artwork, cut-outs, final PNGs), and the
-- test runs. Everything is server-only (RLS on, nothing granted): the pages talk to it through the API.

-- the conversations: one row per chat, the messages kept as they were said (with the attachments and the designs)
create table if not exists public.designer_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  messages jsonb not null default '[]'::jsonb,
  -- the project's record «كاظم» keeps (kind, source, the exact texts, colours, font, size, decisions…)
  record text not null default '' check (char_length(record) <= 20000),
  -- a design ordered and not yet drawn (cleared by the produce step)
  pending jsonb,
  usd numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists designer_chats_user_idx on public.designer_chats (user_id, updated_at desc);
alter table public.designer_chats enable row level security;
revoke all on public.designer_chats from anon, authenticated;

-- the owner's persona text (key «persona») and the section's switch (key «visibility»); absent = the defaults in the code
create table if not exists public.designer_kv (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.designer_kv enable row level security;
revoke all on public.designer_kv from anon, authenticated;

-- what was produced (the artwork جواد drew, a cut-out layer, the final PNG the person saved), in the jawad bucket
create table if not exists public.designer_files (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.designer_chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'artwork' check (role in ('artwork', 'cutout', 'final')),
  bucket text not null default 'jawad',
  path text not null,
  name text not null default '' check (char_length(name) <= 200),
  mime text not null default 'image/png',
  bytes bigint not null default 0,
  width integer,
  height integer,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists designer_files_chat_idx on public.designer_files (chat_id, created_at);
alter table public.designer_files enable row level security;
revoke all on public.designer_files from anon, authenticated;

-- the tests: a run is a batch of scenarios; each result keeps the conversation and the judge's verdict
create table if not exists public.designer_test_runs (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  mode text not null default 'quick' check (mode in ('quick', 'deep')),
  total integer not null check (total between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.designer_test_runs enable row level security;
revoke all on public.designer_test_runs from anon, authenticated;

create table if not exists public.designer_test_results (
  run_id uuid not null references public.designer_test_runs (id) on delete cascade,
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
alter table public.designer_test_results enable row level security;
revoke all on public.designer_test_results from anon, authenticated;
