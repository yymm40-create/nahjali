-- Film branch («صناعة الفيلم السينمائي من الصفر»). Independent from the booklet tables.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.
--
-- Same access model as the booklet: the browser can only READ its own rows (RLS);
-- every write goes through our server routes after an ownership check.

-- ───────────────────────── access & safety caps ─────────────────────────
-- Who may use the film branch while it is in testing (the owner is always allowed in code)
create table public.film_allowed_emails (
  email text primary key check (email = lower(email) and char_length(email) <= 254),
  created_at timestamptz not null default now()
);

-- One row of adjustable spending caps (USD), edited from /admin/film
create table public.film_settings (
  id boolean primary key default true check (id),
  daily_site_cap_usd numeric(10, 2) not null default 30 check (daily_site_cap_usd >= 0),
  monthly_user_cap_usd numeric(10, 2) not null default 10 check (monthly_user_cap_usd >= 0),
  updated_at timestamptz not null default now()
);
insert into public.film_settings default values;

-- ───────────────────────── projects ─────────────────────────
create table public.film_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  story text not null default '' check (char_length(story) <= 20000),
  fixed_facts text not null default '' check (char_length(fixed_facts) <= 5000),
  target_duration_sec integer check (target_duration_sec between 1 and 3600),
  stage text not null default 'screenwriter' check (stage in ('screenwriter', 'sheets', 'director', 'voices', 'done')),
  video_model text not null default 'seedance-2.5' check (video_model in ('seedance-2.5', 'seedance-2.0')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index film_projects_user_idx on public.film_projects (user_id, updated_at desc);
create trigger film_projects_touch_updated_at
  before update on public.film_projects
  for each row execute function public.touch_updated_at();

-- Conversation of each stage (what the user said / what the assistant answered)
create table public.film_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.film_projects (id) on delete cascade,
  stage text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index film_messages_project_idx on public.film_messages (project_id, stage, created_at);

-- Versioned deliverables: understanding, questions, story, screenplay, handoffs, sheet and GEN prompts…
-- `body` is the readable text, `data` the structured copy the next stage reads.
create table public.film_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.film_projects (id) on delete cascade,
  stage text not null,
  kind text not null,
  ref_key text not null default '',            -- e.g. CHR-01, ENV-02, GEN-03
  version integer not null,
  body text not null default '',
  data jsonb not null default '{}',
  status text not null default 'awaiting_approval'
    check (status in ('draft', 'awaiting_approval', 'approved', 'superseded')),
  stale boolean not null default false,         -- an earlier approved decision changed after this one
  created_by text not null check (created_by in ('assistant', 'user')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, kind, ref_key, version)
);
create index film_versions_project_idx on public.film_versions (project_id, kind, ref_key, version desc);

-- Files: user uploads, generated images, videos and audio
create table public.film_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.film_projects (id) on delete cascade,
  kind text not null check (kind in ('upload', 'image', 'video', 'audio')),
  ref_key text not null default '',
  version_id uuid references public.film_versions (id) on delete set null,
  storage_path text,
  file_name text,
  mime text,
  bytes bigint,
  status text not null default 'queued'
    check (status in ('uploaded', 'queued', 'generating', 'generated', 'approved', 'rejected', 'failed')),
  error text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index film_assets_project_idx on public.film_assets (project_id, kind, created_at);
create trigger film_assets_touch_updated_at
  before update on public.film_assets
  for each row execute function public.touch_updated_at();

-- Every paid operation. `idempotency_key` stops the same request from being sent twice.
create table public.film_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.film_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid references public.film_assets (id) on delete set null,
  service text not null check (service in ('anthropic', 'openai_image', 'seedance', 'elevenlabs')),
  operation text not null,
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  provider_task_id text,
  attempts integer not null default 0,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index film_jobs_project_idx on public.film_jobs (project_id, created_at desc);
create index film_jobs_open_idx on public.film_jobs (status) where status in ('queued', 'running');
create trigger film_jobs_touch_updated_at
  before update on public.film_jobs
  for each row execute function public.touch_updated_at();

-- Usage ledger: an estimate is RESERVED when a job is sent, then SETTLED with the real cost
-- on success, or RELEASED on failure (so failures never count against a cap).
create table public.film_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.film_projects (id) on delete set null,
  job_id uuid unique references public.film_jobs (id) on delete set null,
  service text not null,
  operation text not null,
  units numeric(14, 3) not null default 0,     -- tokens, images, seconds or characters
  unit text not null,
  estimated_cost_usd numeric(12, 6) not null default 0,
  actual_cost_usd numeric(12, 6),
  state text not null default 'reserved' check (state in ('reserved', 'settled', 'released')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index film_usage_user_idx on public.film_usage (user_id, created_at);
create index film_usage_created_idx on public.film_usage (created_at);

-- Future packages: prepared, NOT active (no payments yet)
create table public.film_plans (
  id text primary key,
  name text not null,
  price_halalas integer,
  quotas jsonb not null default '{}',
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.film_allowed_emails enable row level security;
alter table public.film_settings enable row level security;
alter table public.film_projects enable row level security;
alter table public.film_messages enable row level security;
alter table public.film_versions enable row level security;
alter table public.film_assets enable row level security;
alter table public.film_jobs enable row level security;
alter table public.film_usage enable row level security;
alter table public.film_plans enable row level security;

create policy "own film projects: read" on public.film_projects
  for select using (user_id = auth.uid());
create policy "own film messages: read" on public.film_messages
  for select using (exists (select 1 from public.film_projects p where p.id = film_messages.project_id and p.user_id = auth.uid()));
create policy "own film versions: read" on public.film_versions
  for select using (exists (select 1 from public.film_projects p where p.id = film_versions.project_id and p.user_id = auth.uid()));
create policy "own film assets: read" on public.film_assets
  for select using (exists (select 1 from public.film_projects p where p.id = film_assets.project_id and p.user_id = auth.uid()));
create policy "own film jobs: read" on public.film_jobs
  for select using (user_id = auth.uid());
create policy "own film usage: read" on public.film_usage
  for select using (user_id = auth.uid());
-- film_allowed_emails, film_settings, film_plans: no policies → server only

-- ───────────────────────── Storage ─────────────────────────
-- Private bucket; files live at <user_id>/<project_id>/… and are shown through short-lived signed URLs.
-- 50 MB is the per-file maximum on the Supabase Free plan.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('film', 'film', false, 52428800,
   array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/wav']);
