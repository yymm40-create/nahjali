-- «زهراء فوتو ماستر»: the photo and graphic editor that opens on its own and is also where «كاظم» sends a design to be
-- retouched and takes it back. Its projects (the canvas as a JSON document, the conversation with «زهراء», the project's
-- record she and the other robots read, and where the project came from), the pictures of each project, and the owner's
-- edits of her persona and the section's switch. Everything is server-only (RLS on, nothing granted): the pages talk to
-- it through the API. Safe to run more than once.

create table if not exists public.photo_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  -- the canvas, the base picture, the sliders and the layers (see src/lib/photo/doc.ts)
  doc jsonb not null default '{}'::jsonb,
  -- the conversation with «زهراء»
  messages jsonb not null default '[]'::jsonb,
  -- the project's record the robots pass between them (what was asked, decided and changed)
  record text not null default '' check (char_length(record) <= 20000),
  -- where it came from: {"kind":"designer","chatId":"…","designId":"…"} | {"kind":"upload"} | {"kind":"work"} | {"kind":"blank"}
  source jsonb,
  usd numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists photo_projects_user_idx on public.photo_projects (user_id, updated_at desc);
alter table public.photo_projects enable row level security;
revoke all on public.photo_projects from anon, authenticated;

-- the pictures of a project: the base picture, pictures over it, what جواد made for it, and what the person exported
create table if not exists public.photo_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.photo_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'base' check (role in ('base', 'layer', 'made', 'export')),
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
create index if not exists photo_files_project_idx on public.photo_files (project_id, created_at);
alter table public.photo_files enable row level security;
revoke all on public.photo_files from anon, authenticated;

-- the owner's persona text (key «persona») and the section's switch (key «visibility»); absent = the defaults in the code
create table if not exists public.photo_kv (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.photo_kv enable row level security;
revoke all on public.photo_kv from anon, authenticated;
