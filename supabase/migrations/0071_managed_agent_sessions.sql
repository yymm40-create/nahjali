-- One Claude Managed Agent session per isolated JAWAD AI conversation or project.
-- Server-only: browsers never read the external session ids.
create table if not exists public.jawad_agent_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  context_type text not null check (context_type in ('jawad', 'sajjad', 'smart_edit')),
  context_key text not null check (char_length(context_key) between 1 and 200),
  session_id text not null check (session_id ~ '^sesn_[A-Za-z0-9]+$'),
  agent_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, context_type, context_key),
  unique (session_id)
);

drop trigger if exists jawad_agent_sessions_touch_updated_at on public.jawad_agent_sessions;
create trigger jawad_agent_sessions_touch_updated_at
  before update on public.jawad_agent_sessions
  for each row execute function public.touch_updated_at();

alter table public.jawad_agent_sessions enable row level security;
revoke all on public.jawad_agent_sessions from anon, authenticated;
