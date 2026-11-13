-- «حيدرة كت»: «سجل التغييرات» · «ارجع لهنا» · «تعليماتي الدايمة». Run once in Supabase: Dashboard → SQL Editor → paste → Run.
-- Safe to run again. Before it runs the log still shows (from editor_ops), «ارجع لهنا» is hidden, and the standing
-- instructions stay in the person's browser. For our server routes only (service role); nobody reads these directly.

-- The steps of a saved change in plain Arabic (حيدرا ماكس's commands of one turn), shown under it in the log.
alter table public.editor_ops add column if not exists steps jsonb check (steps is null or jsonb_typeof(steps) = 'array');

-- Points to come back to: the whole timeline as it was at `version`, kept by the save that replaced it — before and
-- after a turn of حيدرا ماكس, before a «ارجع لهنا», and every few minutes of the person's own work. The server keeps the
-- newest 30 of a project and deletes the older ones.
create table if not exists public.editor_snapshots (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.editor_projects (id) on delete cascade,
  version integer not null,
  timeline jsonb not null,
  created_at timestamptz not null default now()
);
create unique index if not exists editor_snapshots_version_idx on public.editor_snapshots (project_id, version desc);

-- «تعليماتي الدايمة»: what the person wants حيدرا ماكس to do in every edit (their style), one per account.
create table if not exists public.editor_user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  haidara_rules text not null default '' check (char_length(haidara_rules) <= 1500),
  updated_at timestamptz not null default now()
);

alter table public.editor_snapshots enable row level security;
alter table public.editor_user_settings enable row level security;
revoke all on public.editor_snapshots, public.editor_user_settings from anon, authenticated;

notify pgrst, 'reload schema';
