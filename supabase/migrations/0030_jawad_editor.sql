-- «الممنتج الذكي» (JAWAD AI's video editor). Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.
-- Open to every signed-in person. The browser reads and writes only through our server routes (service role) after an
-- ownership check; people may read their own rows directly (RLS), nothing else.

create table if not exists public.editor_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  -- reel · podcast · poem · horizontal
  kind text not null default 'reel' check (kind in ('reel', 'podcast', 'poem', 'horizontal')),
  -- the whole timeline (tracks, clips, text, settings) as one document; `version` rises with every save
  timeline jsonb not null default '{}',
  version integer not null default 1,
  -- a film maker project this edit belongs to (its «المونتاج» step)
  film_project_id uuid references public.film_projects (id) on delete set null,
  -- the last finished export, and when the project's media is deleted (3 days after it)
  export_path text,
  exported_at timestamptz,
  purge_at timestamptz,
  purged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists editor_projects_user_idx on public.editor_projects (user_id, updated_at desc);
create index if not exists editor_projects_purge_idx on public.editor_projects (purge_at) where purge_at is not null;
create unique index if not exists editor_projects_film_idx on public.editor_projects (film_project_id) where film_project_id is not null;

-- Media of a project. The file itself is never changed: clips on the timeline only point at it.
create table if not exists public.editor_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.editor_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('video', 'audio', 'image')),
  -- where the file lives: our own bucket (uploads), or a file of JAWAD AI / the film maker it was taken from
  bucket text not null check (bucket in ('editor', 'jawad', 'film')),
  path text not null check (char_length(path) <= 400),
  name text not null default '' check (char_length(name) <= 200),
  mime text not null default '',
  bytes bigint not null default 0,
  duration_ms integer,
  width integer,
  height integer,
  -- upload · jawad · film · generated
  origin text not null default 'upload' check (origin in ('upload', 'jawad', 'film', 'generated')),
  status text not null default 'pending' check (status in ('pending', 'ready', 'missing')),
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists editor_assets_project_idx on public.editor_assets (project_id, created_at);
create index if not exists editor_assets_source_idx on public.editor_assets (bucket, path);

-- Every saved change, named (who made it: the person, Claude or a skill), for history and undo across sessions.
create table if not exists public.editor_ops (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.editor_projects (id) on delete cascade,
  version integer not null,
  actor text not null default 'user' check (char_length(actor) <= 60),
  label text not null default '' check (char_length(label) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists editor_ops_project_idx on public.editor_ops (project_id, id desc);

alter table public.editor_projects enable row level security;
alter table public.editor_assets enable row level security;
alter table public.editor_ops enable row level security;
drop policy if exists "editor projects: read own" on public.editor_projects;
create policy "editor projects: read own" on public.editor_projects for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "editor assets: read own" on public.editor_assets;
create policy "editor assets: read own" on public.editor_assets for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.editor_projects, public.editor_assets, public.editor_ops from anon, authenticated;
grant select on public.editor_projects, public.editor_assets to authenticated;

-- The editor's own files: private, no size limit of ours (the Supabase plan's limit applies), video incl. WebM.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('editor', 'editor', false, null, array[
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/aac', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/webm', 'audio/flac',
  'image/png', 'image/jpeg', 'image/webp'
])
on conflict (id) do update set public = false, file_size_limit = null, allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
