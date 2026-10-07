-- «سجاد»: the film maker's consultant (a film, a series alone or with a team), and the series' groundwork: its
-- description developed with سجاد's questions (come back to it any time), its visual style, its characters and places
-- (made once, chosen in every scene), and its plan (episodes, scenes, who does which).
-- The browser reads nothing here directly: every read and write goes through the server after an access check.

-- what سجاد knows of a series beyond its title: the developed description, the look, and his notes (facts he keeps)
alter table public.film_series add column if not exists bible text not null default '' check (char_length(bible) <= 30000);
alter table public.film_series add column if not exists style text not null default '' check (char_length(style) <= 4000);
-- a plan سجاد proposed and is waiting for «طبّق الخطة» (episodes with their scenes and who does each)
alter table public.film_series add column if not exists pending_plan jsonb;

-- the series' characters and places (and its style picture, kind 'style'), each with its reference picture
create table if not exists public.film_series_cast (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.film_series (id) on delete cascade,
  kind text not null check (kind in ('style', 'character', 'place')),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 6000),
  -- the English picture prompt سجاد wrote from the description
  prompt text not null default '' check (char_length(prompt) <= 12000),
  storage_path text,
  status text not null default 'none' check (status in ('none', 'generating', 'ready', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists film_series_cast_series_idx on public.film_series_cast (series_id, kind, created_at);
drop trigger if exists film_series_cast_touch_updated_at on public.film_series_cast;
create trigger film_series_cast_touch_updated_at
  before update on public.film_series_cast
  for each row execute function public.touch_updated_at();

-- a scene: who on the team it is given to, and the series' characters and places it uses (sajjad understood them)
alter table public.film_projects add column if not exists assigned_to uuid references auth.users (id) on delete set null;
alter table public.film_projects add column if not exists series_cast jsonb;

-- سجاد's conversation and his notes, one per film or series (scope = 'film:<id>' or 'series:<id>')
create table if not exists public.sajjad_chats (
  scope text primary key check (scope ~ '^(film|series):[0-9a-f-]{36}$'),
  messages jsonb not null default '[]',
  memory jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table public.film_series_cast enable row level security;
alter table public.sajjad_chats enable row level security;
revoke all on public.film_series_cast, public.sajjad_chats from anon, authenticated;
