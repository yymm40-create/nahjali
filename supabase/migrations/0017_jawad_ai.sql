-- «الجواد الذكي!» | JAWAD AI — the AI platform branch (images, video, audio studio + the film maker in its identity).
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again (if not exists / or replace).
--
-- Same access model as the rest of the site: the browser can only READ its own rows (RLS); every write goes
-- through our server routes (service role) after an ownership check. Coins move only through
-- adjust_smart_coins (0015) inside the two functions at the end, so a charge and its job are always atomic.

-- ───────────────────────── identity & admin settings ─────────────────────────
-- Key/value settings edited from /jawad-ai/admin (logo, accent colour…)
create table if not exists public.jawad_settings (
  key text primary key check (char_length(key) between 1 and 64),
  value jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Section overrides and additions. The code registry (config/jawad/sections.ts) holds the built-in sections and
-- the implemented components; a row here renames, reorders, hides or adds a section. A row whose
-- implementation is not in the code is never shown to users.
create table if not exists public.jawad_sections (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,31}$'),
  name text not null check (char_length(name) between 1 and 40),
  icon text not null default '' check (char_length(icon) <= 16),
  implementation text not null check (char_length(implementation) <= 40),
  sort integer not null default 100 check (sort between 0 and 10000),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Generator overrides: shown name, sample picture, section, order, on/off. Capabilities stay in the code
-- registry (config/jawad/generators.ts); a setting here can never add a capability.
create table if not exists public.jawad_generators (
  id text primary key check (char_length(id) <= 64),
  display_name text check (char_length(display_name) <= 60),
  sample_path text check (char_length(sample_path) <= 300),
  section_id text check (char_length(section_id) <= 32),
  sort integer not null default 100 check (sort between 0 and 10000),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

-- «النقود الذكية» prices of each generator, per supported price key, in hundredths of a coin.
-- A missing row means the code default (computed from the provider's verified price); a key whose default is
-- unverified stays unavailable until the owner sets it here.
create table if not exists public.jawad_price_rules (
  generator_id text not null check (char_length(generator_id) <= 64),
  price_key text not null check (char_length(price_key) <= 64),
  centicoins integer not null check (centicoins between 1 and 10000000),
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (generator_id, price_key)
);

-- Every price change (null = the code default)
create table if not exists public.jawad_price_log (
  id bigint generated always as identity primary key,
  generator_id text not null,
  price_key text not null,
  old_centicoins integer,
  new_centicoins integer,
  changed_by text not null,
  changed_at timestamptz not null default now()
);
create index if not exists jawad_price_log_idx on public.jawad_price_log (changed_at desc);

-- The home page ads. `draft` is what the owner edits and previews; `live` is what visitors see (copied on publish).
-- Both hold { title, href, slot: main|side_top|side_bottom, enabled, media: {path,type,mime,width,height}, poster: {path} }.
create table if not exists public.jawad_ads (
  id uuid primary key default gen_random_uuid(),
  draft jsonb not null default '{}',
  live jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── user files, jobs and works ─────────────────────────
-- Reference files the user uploads (checked on the server before use: real type, size, dimensions, duration)
create table if not exists public.jawad_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'audio')),
  storage_path text not null unique,
  file_name text not null default '' check (char_length(file_name) <= 200),
  mime text,
  bytes bigint,
  width integer,
  height integer,
  duration_ms integer,
  fps numeric(6, 2),
  status text not null default 'pending' check (status in ('pending', 'ready', 'rejected')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists jawad_uploads_user_idx on public.jawad_uploads (user_id, created_at desc);

-- One generation. The price shown to the user is stored with it (price_coins, breakdown, version).
-- `idempotency_key` comes from the click: a repeat (double click, retry, reconnect) never makes a second job or charge.
create table if not exists public.jawad_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 80),
  section_id text not null,
  generator_id text not null,
  provider text not null,
  model_id text not null,
  mode text not null,
  output_kind text not null check (output_kind in ('image', 'video', 'audio')),
  prompt text not null default '' check (char_length(prompt) <= 40000),
  inputs jsonb not null default '{}',
  refs jsonb not null default '[]',
  price_coins integer not null check (price_coins >= 0),
  price_breakdown jsonb not null default '[]',
  pricing_version text not null default '',
  charged boolean not null default true,
  charge_state text not null default 'none' check (charge_state in ('none', 'held', 'settled', 'refunded')),
  status text not null default 'queued' check (status in ('queued', 'submitting', 'running', 'saving', 'succeeded', 'failed', 'cancelled')),
  -- 'pending' → 'sending' → 'accepted' | 'rejected'; 'unknown' when a timeout hid whether the provider took it
  submit_state text not null default 'pending' check (submit_state in ('pending', 'sending', 'accepted', 'unknown', 'rejected')),
  progress integer check (progress between 0 and 100),
  provider_task_id text,
  provider_status text,
  submitted_at timestamptz,
  error_message text,
  error_detail text,
  cost_usd_estimate numeric(12, 6),
  cost_usd_actual numeric(12, 6),
  provider_units jsonb,
  lease_until timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists jawad_jobs_user_idx on public.jawad_jobs (user_id, created_at desc);
create index if not exists jawad_jobs_open_idx on public.jawad_jobs (status, created_at) where status in ('queued', 'submitting', 'running', 'saving');
create unique index if not exists jawad_jobs_task_idx on public.jawad_jobs (provider, provider_task_id) where provider_task_id is not null;
drop trigger if exists jawad_jobs_touch_updated_at on public.jawad_jobs;
create trigger jawad_jobs_touch_updated_at before update on public.jawad_jobs for each row execute function public.touch_updated_at();

-- Saved results (in our own storage; the provider's links are temporary)
create table if not exists public.jawad_outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jawad_jobs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'audio')),
  idx integer not null default 0,
  storage_path text not null,
  mime text not null,
  bytes bigint,
  width integer,
  height integer,
  duration_ms integer,
  poster_path text,
  created_at timestamptz not null default now(),
  unique (job_id, idx)
);
create index if not exists jawad_outputs_user_idx on public.jawad_outputs (user_id, created_at desc);

-- What happened to each job (status changes, provider callbacks, refunds) for the owner's follow-up
create table if not exists public.jawad_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.jawad_jobs (id) on delete cascade,
  type text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists jawad_job_events_job_idx on public.jawad_job_events (job_id, id);

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.jawad_settings enable row level security;
alter table public.jawad_sections enable row level security;
alter table public.jawad_generators enable row level security;
alter table public.jawad_price_rules enable row level security;
alter table public.jawad_price_log enable row level security;
alter table public.jawad_ads enable row level security;
alter table public.jawad_uploads enable row level security;
alter table public.jawad_jobs enable row level security;
alter table public.jawad_outputs enable row level security;
alter table public.jawad_job_events enable row level security;

drop policy if exists "own jawad uploads: read" on public.jawad_uploads;
create policy "own jawad uploads: read" on public.jawad_uploads for select using (user_id = auth.uid());
drop policy if exists "own jawad jobs: read" on public.jawad_jobs;
create policy "own jawad jobs: read" on public.jawad_jobs for select using (user_id = auth.uid());
drop policy if exists "own jawad outputs: read" on public.jawad_outputs;
create policy "own jawad outputs: read" on public.jawad_outputs for select using (user_id = auth.uid());
-- settings, sections, generators, prices, price log, ads, job events: no policies → server only

-- ───────────────────────── Storage ─────────────────────────
-- Private: users' references and results at <user_id>/…, shown through short-lived signed URLs after an
-- ownership check. 50 MB is the per-file maximum on the Supabase Free plan.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('jawad', 'jawad', false, 52428800,
   array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime',
         'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/mp4'])
on conflict (id) do nothing;
-- Public: the owner's brand files, ads and generator sample pictures (written by the server only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('jawad-public', 'jawad-public', true, 52428800,
   array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'])
on conflict (id) do nothing;

-- ───────────────────────── atomic charge / refund ─────────────────────────
-- Creates a job and, when p_charge, takes its price from the wallet in the SAME transaction.
--   • the same (user, idempotency_key) returns the existing job (created = false) and charges nothing;
--   • a short balance raises JAWAD_INSUFFICIENT and nothing is kept (no job, no charge);
--   • more than p_max_active unfinished jobs raises JAWAD_BUSY.
-- A per-user advisory lock serialises the checks, so concurrent clicks cannot spend the same coins twice.
create or replace function public.jawad_create_job(p_job jsonb, p_charge boolean, p_max_active integer default 3, p_label text default '')
returns table (job_id uuid, created boolean, job_status text, balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (p_job ->> 'user_id')::uuid;
  v_key text := p_job ->> 'idempotency_key';
  v_price integer := coalesce((p_job ->> 'price_coins')::integer, 0);
  v_id uuid;
  v_status text;
  v_active integer;
  v_balance integer;
begin
  if v_user is null or v_key is null then
    raise exception 'JAWAD_BAD_INPUT';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('jawad:' || v_user::text, 0));

  select j.id, j.status into v_id, v_status from jawad_jobs j where j.user_id = v_user and j.idempotency_key = v_key;
  if v_id is not null then
    return query select v_id, false, v_status, null::integer;
    return;
  end if;

  select count(*) into v_active from jawad_jobs j
   where j.user_id = v_user and j.status in ('queued', 'submitting', 'running', 'saving');
  if v_active >= p_max_active then
    raise exception 'JAWAD_BUSY';
  end if;

  insert into jawad_jobs (user_id, idempotency_key, section_id, generator_id, provider, model_id, mode, output_kind,
                          prompt, inputs, refs, price_coins, price_breakdown, pricing_version, charged, charge_state,
                          cost_usd_estimate)
  values (v_user, v_key, p_job ->> 'section_id', p_job ->> 'generator_id', p_job ->> 'provider', p_job ->> 'model_id',
          p_job ->> 'mode', p_job ->> 'output_kind', coalesce(p_job ->> 'prompt', ''),
          coalesce(p_job -> 'inputs', '{}'::jsonb), coalesce(p_job -> 'refs', '[]'::jsonb), v_price,
          coalesce(p_job -> 'price_breakdown', '[]'::jsonb), coalesce(p_job ->> 'pricing_version', ''),
          p_charge, case when p_charge and v_price > 0 then 'held' else 'none' end,
          nullif(p_job ->> 'cost_usd_estimate', '')::numeric)
  returning id into v_id;

  if p_charge and v_price > 0 then
    v_balance := adjust_smart_coins(v_user, -v_price, 'reserve', v_id::text, p_label, false);
    if v_balance is null then
      raise exception 'JAWAD_INSUFFICIENT';
    end if;
  end if;

  insert into jawad_job_events (job_id, type, detail) values (v_id, 'created', jsonb_build_object('price', v_price, 'charged', p_charge));
  return query select v_id, true, 'queued'::text, v_balance;
end;
$$;
revoke all on function public.jawad_create_job(jsonb, boolean, integer, text) from public, anon, authenticated;

-- Ends a job exactly once. Success keeps the charge; failure or cancellation gives every held coin back.
-- Returns false when the job had already ended (a repeated callback or poll changes nothing).
create or replace function public.jawad_finish_job(p_job uuid, p_status text, p_error_message text default null,
                                                   p_error_detail text default null, p_cost_usd numeric default null,
                                                   p_units jsonb default null, p_label text default '')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r jawad_jobs%rowtype;
begin
  if p_status not in ('succeeded', 'failed', 'cancelled') then
    raise exception 'JAWAD_BAD_STATUS';
  end if;
  select * into r from jawad_jobs where id = p_job for update;
  if not found or r.status in ('succeeded', 'failed', 'cancelled') then
    return false;
  end if;

  update jawad_jobs
     set status = p_status,
         progress = case when p_status = 'succeeded' then 100 else progress end,
         error_message = case when p_status = 'succeeded' then null else coalesce(p_error_message, error_message) end,
         error_detail = case when p_status = 'succeeded' then null else coalesce(p_error_detail, error_detail) end,
         cost_usd_actual = coalesce(p_cost_usd, cost_usd_actual),
         provider_units = coalesce(p_units, provider_units),
         charge_state = case when r.charge_state = 'held' then (case when p_status = 'succeeded' then 'settled' else 'refunded' end) else r.charge_state end,
         lease_until = null,
         finished_at = now()
   where id = p_job;

  if p_status <> 'succeeded' and r.charge_state = 'held' and r.price_coins > 0 then
    perform adjust_smart_coins(r.user_id, r.price_coins, 'refund', r.id::text, p_label, true);
  end if;

  insert into jawad_job_events (job_id, type, detail)
  values (p_job, p_status, jsonb_build_object('refunded', p_status <> 'succeeded' and r.charge_state = 'held', 'coins', r.price_coins));
  return true;
end;
$$;
revoke all on function public.jawad_finish_job(uuid, text, text, text, numeric, jsonb, text) from public, anon, authenticated;
