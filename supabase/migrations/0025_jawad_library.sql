-- «الجواد الذكي!» | JAWAD AI · «المكتبة»: an add-on (50 SAR a month) that opens the person's library — their own
-- voices (designed from a description, or their very voice from a recording), and characters and places kept as
-- pictures (made from a description, or from their own picture), each mentioned by «@name» in any prompt.
-- The owner always has it. Until payments are connected, the owner turns it on for someone from /admin/limits.
--
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again. It includes the voice library of
-- 0023 as well (nothing changes if 0023 was already run), so this one file is enough.

-- ───────────────────────── the voice library (same as 0023) ─────────────────────────
create table if not exists public.jawad_voices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'elevenlabs' check (provider in ('elevenlabs')),
  provider_voice_id text not null unique check (char_length(provider_voice_id) between 8 and 64),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  description text not null default '' check (char_length(description) <= 1000),
  origin text not null check (origin in ('design', 'clone')),
  -- A short sample to listen to (private «jawad» bucket)
  preview_path text check (preview_path is null or char_length(preview_path) <= 300),
  price_coins integer not null default 0 check (price_coins >= 0),
  created_at timestamptz not null default now()
);
create index if not exists jawad_voices_user_idx on public.jawad_voices (user_id, created_at desc);

alter table public.jawad_voices enable row level security;
drop policy if exists "jawad voices: read own" on public.jawad_voices;
create policy "jawad voices: read own" on public.jawad_voices
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.jawad_voices from anon, authenticated;
grant select on public.jawad_voices to authenticated;

-- A voice being designed: its spoken previews wait here until the person keeps one (server only)
create table if not exists public.jawad_voice_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 80),
  description text not null check (char_length(description) <= 1000),
  -- [{ generatedVoiceId, path, durationSec }]
  previews jsonb not null default '[]'::jsonb,
  price_coins integer not null default 0 check (price_coins >= 0),
  status text not null default 'running' check (status in ('running', 'ready', 'failed', 'used')),
  error text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists jawad_voice_drafts_user_idx on public.jawad_voice_drafts (user_id, created_at desc);
alter table public.jawad_voice_drafts enable row level security;
revoke all on public.jawad_voice_drafts from anon, authenticated;

-- ───────────────────────── the film maker's voices («الأصوات») ─────────────────────────
-- Which voice speaks for each speaker of a film project (from the person's library or ElevenLabs' ready voices).
-- The spoken lines themselves are kept as the project's audio files (film_assets, kind 'audio'). Server only.
create table if not exists public.film_voice_cast (
  project_id uuid not null references public.film_projects (id) on delete cascade,
  speaker text not null check (char_length(btrim(speaker)) between 1 and 80),
  voice text not null check (voice ~ '^(p:[A-Za-z0-9]{16,32}|v:[0-9a-f-]{36})$'),
  updated_at timestamptz not null default now(),
  primary key (project_id, speaker)
);
alter table public.film_voice_cast enable row level security;
revoke all on public.film_voice_cast from anon, authenticated;

-- ───────────────────────── «المكتبة»: who has it, until when ─────────────────────────
alter table public.smart_coin_wallets
  add column if not exists library_until timestamptz,
  add column if not exists library_period text check (library_period in ('monthly', 'yearly'));

-- ───────────────────────── characters and places ─────────────────────────
-- Each one is a checked picture of the person's (a jawad_uploads row they own) with the name it is mentioned by.
create table if not exists public.jawad_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('character', 'place')),
  name text not null check (char_length(name) between 1 and 24),
  note text not null default '' check (char_length(note) <= 1000),
  upload_id uuid not null references public.jawad_uploads (id) on delete cascade,
  -- made: from a description (GPT Image 2) · own: the person's picture or one of their results
  origin text not null check (origin in ('made', 'own')),
  job_id uuid references public.jawad_jobs (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists jawad_library_name_idx on public.jawad_library (user_id, lower(name));
create index if not exists jawad_library_user_idx on public.jawad_library (user_id, kind, created_at desc);

alter table public.jawad_library enable row level security;
drop policy if exists "jawad library: read own" on public.jawad_library;
create policy "jawad library: read own" on public.jawad_library
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.jawad_library from anon, authenticated;
grant select on public.jawad_library to authenticated;

-- PostgREST sees the new table and columns at once
notify pgrst, 'reload schema';
