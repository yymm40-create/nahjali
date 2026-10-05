-- «الجواد الذكي!» | JAWAD AI · the voice library (ElevenLabs): voices a person designs from a description (with or
-- without a reference recording) or copies from a recording, kept to be chosen in Eleven v4 speech and in the film
-- maker's voices. Run once in Supabase: Dashboard → SQL Editor → paste → Run (after 0022). Safe to run again.
--
-- Each saved voice lives in the site's ElevenLabs account (it takes one of the account's voice slots); deleting it
-- here deletes it there. Only the server writes; each person reads their own voices.

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
