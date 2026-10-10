-- «محمد الخارق»: a general conversation with the ROCTCF prompt-builder behind it. His conversations (with the internal
-- template he writes for himself and embodies, which never leaves the server) and the owner's edits of his persona and
-- of who may open the branch. Server-only (RLS on, nothing granted): the pages talk to it through the API.

create table if not exists public.kharq_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  -- the messages as they were said, with the questions, the deliveries and the branches he pointed to
  messages jsonb not null default '[]'::jsonb,
  -- his own ROCTCF template for this project: never sent to the page
  brief text not null default '',
  stage text not null default 'discover' check (stage in ('discover', 'ready', 'making', 'done')),
  usd numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kharq_chats_user_idx on public.kharq_chats (user_id, updated_at desc);
alter table public.kharq_chats enable row level security;
revoke all on public.kharq_chats from anon, authenticated;

-- the owner's persona text (key «persona») and who may open the branch (key «visibility»); absent = the code's default
create table if not exists public.kharq_kv (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.kharq_kv enable row level security;
revoke all on public.kharq_kv from anon, authenticated;
