-- «المسلسل الذكي»: a series → its episodes → their scenes. Every scene is a film project (film_projects) that goes
-- through the same steps (screenwriter → sheets → director → videos → montage → «المشهد الناجح»); an episode is
-- assembled from its scenes' saved montages in order, then sound effects and music are added in «حيدرة كت».
-- Team mode: the series' owner adds people by their @username; they open and work on its scenes, and every paid
-- step is charged to the owner's coins. Individual mode: only the owner.
-- The browser reads nothing here directly: every read and write goes through the server after an access check.

create table if not exists public.film_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  about text not null default '' check (char_length(about) <= 4000),
  mode text not null default 'solo' check (mode in ('solo', 'team')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists film_series_user_idx on public.film_series (user_id, updated_at desc);
drop trigger if exists film_series_touch_updated_at on public.film_series;
create trigger film_series_touch_updated_at
  before update on public.film_series
  for each row execute function public.touch_updated_at();

create table if not exists public.film_episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.film_series (id) on delete cascade,
  number integer not null check (number between 1 and 500),
  title text not null default '' check (char_length(title) <= 80),
  created_at timestamptz not null default now(),
  unique (series_id, number)
);

create table if not exists public.film_series_members (
  series_id uuid not null references public.film_series (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (series_id, user_id)
);
create index if not exists film_series_members_user_idx on public.film_series_members (user_id);

-- a scene is a film project inside an episode
alter table public.film_projects add column if not exists series_id uuid references public.film_series (id) on delete cascade;
alter table public.film_projects add column if not exists episode_id uuid references public.film_episodes (id) on delete cascade;
alter table public.film_projects add column if not exists scene_number integer check (scene_number is null or scene_number between 1 and 500);
create index if not exists film_projects_episode_idx on public.film_projects (episode_id, scene_number);

-- the episode's assembly in «حيدرة كت»
alter table public.editor_projects add column if not exists episode_id uuid references public.film_episodes (id) on delete set null;
create unique index if not exists editor_projects_episode_idx on public.editor_projects (episode_id) where episode_id is not null;

alter table public.film_series enable row level security;
alter table public.film_episodes enable row level security;
alter table public.film_series_members enable row level security;
revoke all on public.film_series, public.film_episodes, public.film_series_members from anon, authenticated;
