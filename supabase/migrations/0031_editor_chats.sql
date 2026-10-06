-- «الممنتج الذكي»: Claude's conversation of each edit, kept for as long as the edit exists (it goes with the project).
-- `handoff` is the summary a new conversation starts from when the person hands a long one over.
create table if not exists public.editor_chats (
  project_id uuid primary key references public.editor_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  messages jsonb not null default '[]',
  handoff text check (handoff is null or char_length(handoff) <= 8000),
  -- how many conversations this edit had (1 + the handoffs)
  chats integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.editor_chats enable row level security;
revoke all on public.editor_chats from anon, authenticated;
