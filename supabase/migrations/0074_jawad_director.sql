-- «جواد المخرج»: conversations and managed-agent sessions are isolated from general Jawad.
create table if not exists public.jawad_director_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_chat_id uuid references public.jawad_director_chats (id) on delete set null,
  title text not null default '' check (char_length(title) <= 120),
  messages jsonb not null default '[]'::jsonb,
  handoff text not null default '' check (char_length(handoff) <= 50000),
  usd numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jawad_director_chats_user_idx
  on public.jawad_director_chats (user_id, updated_at desc);

alter table public.jawad_director_chats enable row level security;
revoke all on public.jawad_director_chats from anon, authenticated;

alter table public.jawad_agent_sessions
  drop constraint if exists jawad_agent_sessions_context_type_check;

alter table public.jawad_agent_sessions
  add constraint jawad_agent_sessions_context_type_check
  check (context_type in ('jawad', 'director', 'sajjad', 'smart_edit'));
