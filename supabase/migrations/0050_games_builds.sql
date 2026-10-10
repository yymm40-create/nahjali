-- «صانع الألعاب الذكي» — «اصنع لي اللعبة»: the games the site builds from a conversation with «قنبر» (the plan, the page,
-- the pictures), each opened by its link /play/<id>. And the conversation's way: the game built here, or a prompt to take
-- elsewhere. Server-only (RLS on, nothing granted): the pages reach it through the API.

alter table public.games_chats add column if not exists mode text not null default '' check (mode in ('', 'build', 'prompt'));

create table if not exists public.games_builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chat_id uuid references public.games_chats (id) on delete set null,
  title text not null default '' check (char_length(title) <= 120),
  summary text not null default '' check (char_length(summary) <= 400),
  -- what «قنبر» planned: the spec, the cover's prompt and the pictures' prompts
  plan jsonb not null default '{}'::jsonb,
  -- the pictures as drawn: { id: { state, file, tries, error } } (the cover's id is «cover»)
  art jsonb not null default '{}'::jsonb,
  -- the page served (with the pictures' placeholders) and the one being written or fixed
  html text,
  draft text,
  version integer not null default 0,
  status text not null default 'building' check (status in ('building', 'ready', 'failed')),
  code_state text not null default 'pending' check (code_state in ('pending', 'writing', 'broken', 'done', 'failed')),
  -- what the next code step does: the problems to fix, or the client's change
  code_note text not null default '',
  code_tries integer not null default 0,
  code_started_at timestamptz,
  art_state text not null default 'pending' check (art_state in ('pending', 'drawing', 'done')),
  art_started_at timestamptz,
  -- the last thing that went wrong, shown to the person
  last_error text not null default '',
  -- what players' browsers reported (the next fix reads them)
  errors jsonb not null default '[]'::jsonb,
  usd numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists games_builds_user_idx on public.games_builds (user_id, created_at desc);
create index if not exists games_builds_chat_idx on public.games_builds (chat_id, created_at);
alter table public.games_builds enable row level security;
revoke all on public.games_builds from anon, authenticated;
