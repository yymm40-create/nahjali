-- «الجواد الذكي!» | JAWAD AI · «الطالب الذكي»: a student's material (typed text, pictures, PDF) → reviewed full text →
-- approved understanding → summaries, explanations, a verbatim transcript, a reading book (PDF), slides (PPTX + PDF),
-- audio (ElevenLabs) and quizzes, every stage approved by the student before the next one is built on it.
--
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.
-- Users can read their own rows; every write goes through the server (service role) after an ownership check.
-- A project is deleted 30 days after its last activity (the daily cron), with its files.

create table if not exists public.student_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  level text not null default '' check (char_length(level) <= 120),
  audience text not null default '' check (char_length(audience) <= 300),
  -- where the student is: sources → review → understanding → scope → outputs
  stage text not null default 'sources' check (stage in ('sources', 'review', 'understanding', 'scope', 'outputs')),
  -- the approved versions everything after them is built on (0 = none yet)
  text_version integer not null default 0,
  understanding_version integer not null default 0,
  research_version integer not null default 0,
  -- the two separate questions: may the assistant add from its own knowledge? may it search the web?
  allow_additions boolean,
  web_search boolean,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists student_projects_user_idx on public.student_projects (user_id, last_activity_at desc);

create table if not exists public.student_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.student_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  ord integer not null default 0,
  kind text not null check (kind in ('text', 'image', 'pdf')),
  name text not null default '' check (char_length(name) <= 300),
  -- a file in the private «student» bucket (pictures, PDF); null for typed text
  path text check (path is null or char_length(path) <= 400),
  mime text not null default '',
  bytes bigint not null default 0,
  pages integer not null default 0,
  -- typed text, kept exactly as written
  body text,
  status text not null default 'pending' check (status in ('pending', 'ready', 'rejected')),
  -- pages already read (a long PDF is read a batch at a time)
  pages_done integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists student_sources_project_idx on public.student_sources (project_id, ord);

-- The extracted text, one row per page / picture / part. raw_text is what was extracted and never changes;
-- text is the student's corrected version.
create table if not exists public.student_segments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.student_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid not null references public.student_sources (id) on delete cascade,
  page integer not null default 1,
  part integer not null default 1,
  label text not null default '',
  raw_text text not null default '',
  text text not null default '',
  uncertain jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  updated_at timestamptz not null default now(),
  unique (source_id, page, part)
);
create index if not exists student_segments_project_idx on public.student_segments (project_id);

-- Approved versions of the full text, the understanding and the web research (each later stage records the version
-- it was built on).
create table if not exists public.student_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.student_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('text', 'understanding', 'research')),
  version integer not null,
  content jsonb not null,
  approved boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (project_id, kind, version)
);

create table if not exists public.student_outputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.student_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('summary', 'explain', 'transcript', 'book', 'slides', 'audio', 'quiz')),
  ord integer not null default 0,
  title text not null default '',
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'settings',
  -- e.g. audio reading an approved summary
  depends_on uuid references public.student_outputs (id) on delete set null,
  -- the versions this output was built on: {text, understanding, research, dependency}
  based_on jsonb not null default '{}'::jsonb,
  stale boolean not null default false,
  plan jsonb,
  plan_approved boolean not null default false,
  trial jsonb,
  trial_coins integer not null default 0,
  content jsonb,
  files jsonb not null default '{}'::jsonb,
  approved boolean not null default false,
  requests jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists student_outputs_project_idx on public.student_outputs (project_id, ord);

create table if not exists public.student_output_history (
  id uuid primary key default gen_random_uuid(),
  output_id uuid not null references public.student_outputs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

-- Long, paid steps. The same (user, idempotency_key) is the same job: a repeated click never runs or charges twice.
create table if not exists public.student_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.student_projects (id) on delete cascade,
  output_id uuid references public.student_outputs (id) on delete cascade,
  kind text not null,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{8,80}$'),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  stage text not null default '',
  progress jsonb not null default '{}'::jsonb,
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  estimate_usd numeric not null default 0,
  cost_usd numeric not null default 0,
  lease_until timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (user_id, idempotency_key)
);
create index if not exists student_jobs_open_idx on public.student_jobs (status, updated_at) where status in ('queued', 'running');
create index if not exists student_jobs_project_idx on public.student_jobs (project_id, created_at desc);

-- Audio is made a part at a time: a failed part is made again alone, the finished ones are kept.
create table if not exists public.student_audio_parts (
  id uuid primary key default gen_random_uuid(),
  output_id uuid not null references public.student_outputs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  run integer not null default 1,
  idx integer not null,
  file_idx integer not null default 1,
  text text not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  path text,
  bytes integer not null default 0,
  seconds numeric not null default 0,
  attempts integer not null default 0,
  error text,
  unique (output_id, run, idx)
);

create table if not exists public.student_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  output_id uuid not null references public.student_outputs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score numeric,
  created_at timestamptz not null default now()
);

-- ───────────────────────── access: read own, write through the server ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['student_projects', 'student_sources', 'student_segments', 'student_versions', 'student_outputs',
                           'student_output_history', 'student_jobs', 'student_audio_parts', 'student_quiz_attempts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "read own" on public.%I', t);
    execute format('create policy "read own" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- ───────────────────────── Storage ─────────────────────────
-- Private: <user_id>/<project_id>/… — sources, generated files. No size limit set here (the owner's choice: none in
-- the product); Supabase's own per-file limit in the project settings still applies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('student', 'student', false, null,
   array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'text/plain',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set file_size_limit = null, allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
