-- «لأجل المهدي»: «المسابقة» (a day's team race). The leader runs it from one panel: two teams, players who join with a selfie,
-- rounds, points and a secret spy per team. Everyone else follows live. All reads and writes go through the server (service
-- role) because a player must never read another's spy row. Safe to run twice.

create table if not exists public.mahdi_races (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  code text not null unique check (char_length(code) between 4 and 12),
  team_a text not null default 'فريق المفتاح' check (char_length(team_a) between 1 and 30),
  team_b text not null default 'فريق الفليفلة' check (char_length(team_b) between 1 and 30),
  emoji_a text not null default '🔑' check (char_length(emoji_a) <= 8),
  emoji_b text not null default '🫑' check (char_length(emoji_b) <= 8),
  banned text not null default '' check (char_length(banned) <= 30),
  current_round uuid,
  spies_on boolean not null default false,
  revealed boolean not null default false,
  winner text check (winner in ('a', 'b', 'tie')),
  created_at timestamptz not null default now()
);
create index if not exists mahdi_races_owner_idx on public.mahdi_races (owner_id);

create table if not exists public.mahdi_race_players (
  race_id uuid not null references public.mahdi_races (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  selfie text check (selfie is null or char_length(selfie) <= 200000),
  selfie_v integer not null default 0,
  team text check (team in ('a', 'b')),
  kid boolean not null default false,
  spy boolean not null default false,
  missions jsonb not null default '[]',
  joined_at timestamptz not null default now(),
  primary key (race_id, user_id)
);
create index if not exists mahdi_race_players_user_idx on public.mahdi_race_players (user_id);

create table if not exists public.mahdi_race_rounds (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.mahdi_races (id) on delete cascade,
  pos integer not null default 0,
  name text not null check (char_length(name) between 1 and 60),
  icon text not null default '🎯' check (char_length(icon) <= 8),
  how text not null default '' check (char_length(how) <= 1500),
  tools text not null default '' check (char_length(tools) <= 200),
  pts text not null default '' check (char_length(pts) <= 120),
  water boolean not null default false,
  tool text not null default 'timer' check (char_length(tool) <= 12),
  word_set text not null default '' check (char_length(word_set) <= 8),
  per integer not null default 0,
  secs integer not null default 0,
  done boolean not null default false
);
create index if not exists mahdi_race_rounds_race_idx on public.mahdi_race_rounds (race_id, pos);

create table if not exists public.mahdi_race_points (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.mahdi_races (id) on delete cascade,
  team text not null check (team in ('a', 'b')),
  points integer not null check (points between -1000 and 1000),
  reason text not null default '' check (char_length(reason) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists mahdi_race_points_race_idx on public.mahdi_race_points (race_id, created_at);

-- Everything that happens, with exact times, so the day can be read back and cut into a film later.
create table if not exists public.mahdi_race_events (
  id bigint generated always as identity primary key,
  race_id uuid not null references public.mahdi_races (id) on delete cascade,
  at timestamptz not null default now(),
  client_at timestamptz,
  actor uuid,
  actor_name text,
  kind text not null check (char_length(kind) <= 40),
  data jsonb not null default '{}'
);
create index if not exists mahdi_race_events_race_idx on public.mahdi_race_events (race_id, id);

alter table public.mahdi_races enable row level security;
alter table public.mahdi_race_players enable row level security;
alter table public.mahdi_race_rounds enable row level security;
alter table public.mahdi_race_points enable row level security;
alter table public.mahdi_race_events enable row level security;
-- No policies on purpose: only the server (service role) reaches these tables.
revoke all on public.mahdi_races, public.mahdi_race_players, public.mahdi_race_rounds, public.mahdi_race_points, public.mahdi_race_events from anon, authenticated;

notify pgrst, 'reload schema';
