-- «🎬 مختبر الموشن»: every conversation of the lab, kept on the server (a project has as many as the person opens).
-- The state is the lab's whole work in that conversation: its cards (the scenario, the versions, the drafts, the cover),
-- the plan, the program and the choices — so it opens again on any device.
create table if not exists public.motion_lab_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.editor_projects (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists motion_lab_chats_project_idx
  on public.motion_lab_chats (user_id, project_id, updated_at desc);

alter table public.motion_lab_chats enable row level security;
revoke all on public.motion_lab_chats from anon, authenticated;
